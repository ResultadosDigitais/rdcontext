import { embedNormalized, getCurrentProvider } from '../ai/embed';
import { snippetStoreV2 } from '../db/snippet-store-v2';
import type { Snippet } from '../db/schema-v2';

export interface GetOptions {
  name: string;
  topic?: string;
  k: number;
  crossProvider?: boolean; // New: allow cross-provider search
}

const getAllSnippets = async ({ name, k }: GetOptions): Promise<Snippet[]> => {
  return await snippetStoreV2.getAllSnippets(name, k);
};

const similaritySearch = async ({
  name,
  topic,
  k,
  crossProvider = false,
}: GetOptions & { topic: string }): Promise<Array<Snippet & { similarity: number }>> => {
  const provider = getCurrentProvider();
  
  // Generate normalized embedding for search
  const queryEmbedding = await embedNormalized(topic);
  
  // Use cross-provider search if requested (searches across all providers)
  if (crossProvider) {
    return await snippetStoreV2.crossProviderSearch(name, queryEmbedding, provider, k);
  }
  
  // Standard provider-aware search
  return await snippetStoreV2.similaritySearch(name, queryEmbedding, provider, k);
};

export const getV2 = async ({ name, topic, k, crossProvider = false }: GetOptions) => {
  try {
    const startTime = Date.now();
    const provider = getCurrentProvider();
    
    console.log(`🔍 Searching with ${provider} provider${crossProvider ? ' (cross-provider enabled)' : ''}...`);
    
    const results = topic
      ? await similaritySearch({ name, topic, k, crossProvider })
      : await getAllSnippets({ name, k });

    const duration = Date.now() - startTime;
    
    if (results.length === 0) {
      const message = `No snippets found for library "${name}"${topic ? ` with topic: "${topic}"` : ''}`;
      console.log(`📊 Query completed in ${duration}ms - no results`);
      return message;
    }

    // Enhanced formatting with similarity scores and provider info
    const snippets = results.map((snippet) => {
      let output = `TITLE: ${snippet.title}
DESCRIPTION: ${snippet.description}
LANGUAGE: ${snippet.language}
PROVIDER: ${snippet.provider} (${snippet.embedding_dims}d)`;

      // Add similarity score if available
      if ('similarity' in snippet && snippet.similarity !== undefined) {
        output += `
SIMILARITY: ${(snippet.similarity * 100).toFixed(1)}%`;
      }

      output += `
CODE:
\`\`\`${snippet.language || ''}
${snippet.code}
\`\`\``;

      return output;
    });

    // Enhanced logging with provider statistics
    const providerStats = results.reduce((acc, r) => {
      acc[r.provider] = (acc[r.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 Query completed in ${duration}ms`);
    console.log(`   📈 Found ${results.length} snippets`);
    console.log(`   🤖 Providers: ${Object.entries(providerStats).map(([p, c]) => `${p}(${c})`).join(', ')}`);
    console.log(`   🎯 Search: ${crossProvider ? 'Cross-provider' : 'Provider-specific'}`);

    return snippets.join('\n----------------------------------------\n');
  } catch (error) {
    console.error('❌ Search failed:', error);
    return `Failed to retrieve snippets: ${error.message}`;
  }
};

// Enhanced get function with statistics
export const getWithStats = async (options: GetOptions) => {
  const results = await getV2(options);
  const stats = await snippetStoreV2.getLibraryStats(options.name);
  
  return {
    results,
    stats,
    searchConfig: {
      provider: getCurrentProvider(),
      crossProvider: options.crossProvider,
      normalizedDimensions: 3072,
    },
  };
};

// Health check endpoint
export const healthCheck = async () => {
  const health = await snippetStoreV2.healthCheck();
  
  console.log(`🏥 System Health: ${health.status.toUpperCase()}`);
  console.log(`   📊 Metadata: ${health.metadata ? '✅' : '❌'}`);
  console.log(`   🧠 Vectors: ${health.vectors ? '✅' : '❌'}`);
  console.log(`   ⚡ Performance: ${health.performance}ms`);
  
  return health;
};