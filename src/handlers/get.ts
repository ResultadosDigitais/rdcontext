import { embed } from '../ai';
import { snippetStoreV2 } from '../db/snippet-store-v2';
import type { Snippet } from '../db/schema-v2';

export interface GetOptions {
  name: string;
  topic?: string;
  k: number;
}

const all = async ({ name, k }: GetOptions): Promise<Snippet[]> => {
  const provider = snippetStoreV2.getCurrentProvider();
  return await snippetStoreV2.getAllSnippets(name, k);
};

const similarity = async ({
  name,
  topic,
  k,
}: GetOptions & { topic: string }): Promise<Snippet[]> => {
  const provider = snippetStoreV2.getCurrentProvider();
  const vector = await embed(topic);
  
  // Use cross-provider vector search with normalized embeddings
  return await snippetStoreV2.similaritySearch(name, vector, provider, k);
};

export const get = async ({ name, topic, k }: GetOptions) => {
  try {
    const startTime = Date.now();
    const results = topic
      ? await similarity({ name, topic, k })
      : await all({ name, topic, k });

    const duration = Date.now() - startTime;
    console.log(`Query completed in ${duration}ms, found ${results.length} snippets`);

    if (results.length === 0) {
      return `No snippets found for library "${name}"${topic ? ` with topic: "${topic}"` : ''}`;
    }

    const snippets = results.map(
      (snippet) => `TITLE: ${snippet.title}
DESCRIPTION: ${snippet.description}
LANGUAGE: ${snippet.language}${snippet.provider ? `
PROVIDER: ${snippet.provider}` : ''}
CODE:
\`\`\`${snippet.language || ''}
${snippet.code}
\`\`\``,
    );
    return snippets.join('\n----------------------------------------\n');
  } catch (error) {
    console.error('Failed to retrieve snippets:', error);
    return `Failed to retrieve snippets: ${error.message}`;
  }
};
