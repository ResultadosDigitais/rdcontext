import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { vectorStore } from './vector-store';
import { snippet, library } from './schema-v2';
import type { Snippet, CreateSnippet, EmbeddingProvider } from './schema-v2';
import { getCurrentProvider } from '../ai/embed';

// Optimized snippet store using sqlite-vec for 2025
export class SnippetStoreV2 {
  
  // Initialize the store (ensures sqlite-vec is loaded)
  async init() {
    await vectorStore.init();
  }

  // Get current provider from environment
  getCurrentProvider(): EmbeddingProvider {
    return getCurrentProvider();
  }

  // Insert snippets with automatic vector storage
  async insertSnippets(
    snippets: Array<Omit<CreateSnippet, 'id'> & { embedding: number[] }>
  ): Promise<number[]> {
    await this.init();
    
    if (snippets.length === 0) return [];

    const insertedIds: number[] = [];
    const provider = this.getCurrentProvider();
    
    // Use deferred transaction to reduce locking issues
    await db.transaction(async (tx) => {
      for (const snippetData of snippets) {
        const { embedding, ...metadata } = snippetData;
        
        // Insert metadata with provider
        const [inserted] = await tx
          .insert(snippet)
          .values({
            ...metadata,
            provider,
            embedding_dims: embedding.length,
          })
          .returning({ id: snippet.id });

        const snippetId = inserted.id;
        insertedIds.push(snippetId);
      }
    }, {
      behavior: 'deferred'  // Use deferred transaction to reduce locking
    });

    // Store vectors outside of the main transaction to avoid conflicts
    console.log(`🏗️  Building optimized index with sqlite-vec...`);
    const vectorOperations = snippets.map((snippetData, index) => ({
      snippetId: insertedIds[index],
      embedding: snippetData.embedding,
      provider
    }));

    // Batch vector operations to reduce database contention
    await vectorStore.storeVectors(vectorOperations);

    console.log(`✅ Stored ${snippets.length} snippets with ${provider} embeddings (normalized to 3072d)`);
    return insertedIds;
  }

  // Delete all snippets for a library
  async deleteLibrarySnippets(libraryName: string): Promise<void> {
    await this.init();
    
    try {
      // Delete vectors first
      await vectorStore.deleteVectorsByLibrary(libraryName);
      
      // Then delete metadata
      await db.delete(snippet).where(eq(snippet.library, libraryName));
      
      console.log(`🗑️  Deleted all snippets for library: ${libraryName}`);
    } catch (error) {
      console.warn(`⚠️  Could not delete existing snippets for ${libraryName}:`, error.message);
      // Continue anyway - this might be the first time adding this library
    }
  }

  // Get all snippets for a library (metadata only)
  async getAllSnippets(
    libraryName: string, 
    limit: number = 10
  ): Promise<Snippet[]> {
    await this.init();
    
    return await db
      .select()
      .from(snippet)
      .where(eq(snippet.library, libraryName))
      .limit(limit);
  }

  // Vector similarity search with cross-provider support
  async similaritySearch(
    libraryName: string,
    queryEmbedding: number[],
    provider: EmbeddingProvider,
    limit: number = 10
  ): Promise<Array<Snippet & { similarity: number }>> {
    await this.init();
    
    // Get similar vectors using sqlite-vec
    const vectorResults = await vectorStore.similaritySearch(
      queryEmbedding,
      provider,
      limit * 2, // Get more to account for library filtering
      libraryName
    );

    if (vectorResults.length === 0) {
      return [];
    }

    // Get snippet metadata for the matching vectors
    const snippetIds = vectorResults.map(r => r.snippetId);
    
    const snippets = await db
      .select()
      .from(snippet)
      .where(sql`${snippet.id} IN (${sql.join(snippetIds.map(id => sql`${id}`), sql`, `)})`)
      .limit(limit);

    // Combine metadata with similarity scores
    const results = snippets.map(s => {
      const vectorResult = vectorResults.find(v => v.snippetId === s.id);
      return {
        ...s,
        similarity: vectorResult ? 1 - vectorResult.distance : 0, // Convert distance to similarity
      };
    });

    // Sort by similarity (highest first)
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // Cross-provider similarity search (search across all providers)
  async crossProviderSearch(
    libraryName: string,
    queryEmbedding: number[],
    provider: EmbeddingProvider,
    limit: number = 10
  ): Promise<Array<Snippet & { similarity: number }>> {
    await this.init();
    
    // Since all embeddings are normalized to 3072d, we can search across providers
    const vectorResults = await vectorStore.similaritySearch(
      queryEmbedding,
      provider,
      limit * 3, // Get more results to account for cross-provider comparison
      libraryName
    );

    if (vectorResults.length === 0) {
      return [];
    }

    // Get snippet metadata
    const snippetIds = vectorResults.map(r => r.snippetId);
    
    const snippets = await db
      .select()
      .from(snippet)
      .where(sql`${snippet.id} IN (${sql.join(snippetIds.map(id => sql`${id}`), sql`, `)})`)
      .limit(limit);

    // Combine with similarity scores and provider info
    const results = snippets.map(s => {
      const vectorResult = vectorResults.find(v => v.snippetId === s.id);
      return {
        ...s,
        similarity: vectorResult ? 1 - vectorResult.distance : 0,
      };
    });

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // Get statistics for a library
  async getLibraryStats(libraryName: string): Promise<{
    totalSnippets: number;
    byProvider: Record<string, number>;
    avgEmbeddingDims: number;
    vectorCount: number;
  }> {
    await this.init();
    
    const snippets = await db
      .select()
      .from(snippet)
      .where(eq(snippet.library, libraryName));

    const byProvider = snippets.reduce((acc, s) => {
      acc[s.provider] = (acc[s.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgEmbeddingDims = snippets.length > 0 
      ? snippets.reduce((sum, s) => sum + s.embedding_dims, 0) / snippets.length 
      : 0;

    const vectorCount = await vectorStore.getVectorCount();

    return {
      totalSnippets: snippets.length,
      byProvider,
      avgEmbeddingDims,
      vectorCount,
    };
  }

  // Health check for the entire system
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    metadata: boolean;
    vectors: boolean;
    performance: number;
    details: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Check metadata tables
      const metadataCheck = await db.select().from(snippet).limit(1);
      const metadataOk = Array.isArray(metadataCheck);
      
      // Check vector store
      const vectorCheck = await vectorStore.healthCheck();
      const vectorsOk = vectorCheck.vecEnabled;
      
      const performance = Date.now() - startTime;
      
      const status = (metadataOk && vectorsOk) ? 'healthy' : 
                    (metadataOk || vectorsOk) ? 'degraded' : 'error';
      
      return {
        status,
        metadata: metadataOk,
        vectors: vectorsOk,
        performance,
        details: {
          vectorCheck,
          currentProvider: getCurrentProvider(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        metadata: false,
        vectors: false,
        performance: -1,
        details: { error: error.message },
      };
    }
  }
}

// Export singleton instance
export const snippetStoreV2 = new SnippetStoreV2();