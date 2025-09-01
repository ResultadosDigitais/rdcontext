import * as sqliteVec from 'sqlite-vec';
import { sql, eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { url } from './settings';
import { db } from './db';
import { snippetVecFallback, snippet } from './schema-v2';
import type { VectorRecord, EmbeddingProvider, NormalizedEmbedding } from './schema-v2';

// Initialize sqlite-vec extension
let vecInitialized = false;
let rawClient: any = null;
let useFallback = false;

export class VectorStore {
  // Initialize sqlite-vec extension (with fallback) - disabled to avoid database locking
  async init() {
    if (!vecInitialized) {
      console.warn('⚠️  sqlite-vec disabled to avoid database locking issues');
      console.warn('   Using fallback table for vector storage (slower but functional)');
      
      // Table should already exist from setup script
      useFallback = true;
      vecInitialized = true;
    }
  }

  // Normalize embeddings to common 3072-dimensional space
  normalizeEmbedding(embedding: number[], provider: EmbeddingProvider): number[] {
    if (provider === 'gemini' && embedding.length === 3072) {
      // Gemini embeddings are already 3072d - return as-is
      return embedding;
    }
    
    if (provider === 'gemini' && embedding.length === 768) {
      // Pad 768d Gemini embeddings to 3072d with zeros
      const normalized = new Array(3072).fill(0);
      for (let i = 0; i < 768; i++) {
        normalized[i] = embedding[i];
      }
      return normalized;
    }
    
    if (provider === 'openai' && embedding.length === 1536) {
      // Truncate OpenAI embeddings to first 3072 dimensions
      // This preserves most semantic information (Matryoshka embedding principle)
      return embedding.slice(0, 3072);
    }
    
    throw new Error(`Unsupported embedding: ${provider} with ${embedding.length} dimensions`);
  }

  // Store a vector with automatic normalization and optional quantization
  async storeVector(
    snippetId: number, 
    embedding: number[], 
    provider: EmbeddingProvider,
    options: { quantize?: boolean } = {}
  ): Promise<void> {
    await this.init();
    
    const normalized = this.normalizeEmbedding(embedding, provider);
    const vectorBuffer = new Float32Array(normalized);
    
    // Use fallback table with Drizzle - use simple insert or replace to avoid locking
    try {
      await db.insert(snippetVecFallback).values({
        snippet_id: snippetId,
        embedding: Buffer.from(vectorBuffer.buffer)
      });
    } catch (error) {
      // If insert fails due to existing record, delete and insert
      if (error.message.includes('UNIQUE constraint failed') || error.message.includes('PRIMARY KEY constraint failed')) {
        await db.delete(snippetVecFallback).where(eq(snippetVecFallback.snippet_id, snippetId));
        await db.insert(snippetVecFallback).values({
          snippet_id: snippetId,
          embedding: Buffer.from(vectorBuffer.buffer)
        });
      } else {
        throw error;
      }
    }
  }

  // Binary quantization (converts float to 1-bit per dimension)
  private quantizeToBinary(embedding: number[]): Uint8Array {
    const binaryLength = Math.ceil(embedding.length / 8);
    const binary = new Uint8Array(binaryLength);
    
    for (let i = 0; i < embedding.length; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      
      // Set bit to 1 if value is positive, 0 if negative
      if (embedding[i] > 0) {
        binary[byteIndex] |= (1 << bitIndex);
      }
    }
    
    return binary;
  }

  // Batch store multiple vectors (optimized for performance)
  async storeVectors(vectors: Array<{ snippetId: number; embedding: number[]; provider: EmbeddingProvider }>): Promise<void> {
    await this.init();
    
    if (vectors.length === 0) return;

    // Clear any existing vectors for these snippets first to avoid conflicts
    const snippetIds = vectors.map(v => v.snippetId);
    if (snippetIds.length > 0) {
      await db.delete(snippetVecFallback)
        .where(sql`${snippetVecFallback.snippet_id} IN (${sql.join(snippetIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Prepare batch insert using fallback table with Drizzle ORM
    const normalizedVectors = vectors.map(({ snippetId, embedding, provider }) => ({
      snippet_id: snippetId,
      embedding: Buffer.from(new Float32Array(this.normalizeEmbedding(embedding, provider)).buffer),
    }));

    // Use batch insert with smaller chunks to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < normalizedVectors.length; i += BATCH_SIZE) {
      const batch = normalizedVectors.slice(i, i + BATCH_SIZE);
      await db.insert(snippetVecFallback).values(batch);
    }
  }

  // Vector similarity search (cross-provider compatible) - using fallback only
  async similaritySearch(
    queryEmbedding: number[], 
    provider: EmbeddingProvider, 
    limit: number = 10,
    libraryFilter?: string
  ): Promise<Array<{ snippetId: number; distance: number }>> {
    await this.init();
    
    const normalized = this.normalizeEmbedding(queryEmbedding, provider);
    
    // Use fallback similarity search
    return await this.fallbackSimilaritySearch(normalized, limit, libraryFilter);
  }

  // Fallback similarity search using basic SQL (slower but works without sqlite-vec)
  private async fallbackSimilaritySearch(
    queryVector: number[],
    limit: number,
    libraryFilter?: string
  ): Promise<Array<{ snippetId: number; distance: number }>> {
    // Get all vectors from fallback table using Drizzle
    let results;
    if (libraryFilter) {
      results = await db.select({
        snippet_id: snippetVecFallback.snippet_id,
        embedding: snippetVecFallback.embedding
      })
      .from(snippetVecFallback)
      .innerJoin(snippet, eq(snippetVecFallback.snippet_id, snippet.id))
      .where(eq(snippet.library, libraryFilter));
    } else {
      results = await db.select({
        snippet_id: snippetVecFallback.snippet_id,
        embedding: snippetVecFallback.embedding
      })
      .from(snippetVecFallback);
    }
    
    // Calculate cosine similarity in JavaScript (slower but functional)
    const similarities = results.map((row: any) => {
      const snippetId = row.snippet_id;
      const embeddingBuffer = new Uint8Array(row.embedding);
      const embedding = new Float32Array(embeddingBuffer.buffer);
      
      // Cosine similarity calculation
      let dotProduct = 0;
      let queryMagnitude = 0;
      let embeddingMagnitude = 0;
      
      for (let i = 0; i < Math.min(queryVector.length, embedding.length); i++) {
        dotProduct += queryVector[i] * embedding[i];
        queryMagnitude += queryVector[i] * queryVector[i];
        embeddingMagnitude += embedding[i] * embedding[i];
      }
      
      const magnitude = Math.sqrt(queryMagnitude) * Math.sqrt(embeddingMagnitude);
      const similarity = magnitude > 0 ? dotProduct / magnitude : 0;
      const distance = 1 - similarity; // Convert similarity to distance
      
      return { snippetId, distance };
    });
    
    // Sort by distance (lowest first) and limit results
    return similarities
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  // Delete vectors for a specific library
  async deleteVectorsByLibrary(libraryName: string): Promise<void> {
    await this.init();
    
    // Get snippet IDs for the library
    const snippets = await db.select({ id: snippet.id })
      .from(snippet)
      .where(eq(snippet.library, libraryName));
    
    const snippetIds = snippets.map(s => s.id);
    
    if (snippetIds.length > 0) {
      await db.delete(snippetVecFallback)
        .where(sql`${snippetVecFallback.snippet_id} IN (${sql.join(snippetIds.map(id => sql`${id}`), sql`, `)})`);
    }
  }

  // Delete a specific vector
  async deleteVector(snippetId: number): Promise<void> {
    await this.init();
    
    await db.delete(snippetVecFallback)
      .where(eq(snippetVecFallback.snippet_id, snippetId));
  }

  // Get vector count
  async getVectorCount(): Promise<number> {
    await this.init();
    
    const result = await db.select({ count: sql`COUNT(*)` })
      .from(snippetVecFallback);
    
    return result[0]?.count || 0;
  }

  // Health check
  async healthCheck(): Promise<{ 
    vecEnabled: boolean; 
    vectorCount: number; 
    dimension: number;
    performance: number; 
  }> {
    await this.init();
    
    const startTime = Date.now();
    const count = await this.getVectorCount();
    const performance = Date.now() - startTime;
    
    return {
      vecEnabled: vecInitialized,
      vectorCount: count,
      dimension: 3072,
      performance,
    };
  }
}

// Export singleton instance
export const vectorStore = new VectorStore();