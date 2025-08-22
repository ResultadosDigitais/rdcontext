import { openai } from './openai';
import { geminiEmbed } from './gemini';
import { EmbeddingNormalizer } from './embedding-utils';
import type { EmbeddingProvider } from '../db/schema-v2';

// Enhanced embed function with normalization support
export const embed = async (input: string, normalize: boolean = false): Promise<number[]> => {
  if (!input?.trim()) {
    throw new Error('Input cannot be empty');
  }

  const provider = getCurrentProvider();
  let embedding: number[];

  if (provider === 'gemini') {
    embedding = await geminiEmbed(input);
  } else {
    // Default to OpenAI
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: input,
    });
    embedding = response.data[0].embedding;
  }

  // Validate embedding dimensions
  if (!EmbeddingNormalizer.validateEmbedding(embedding, provider)) {
    console.warn(`Unexpected embedding dimensions: ${embedding.length} for ${provider}`);
  }

  // Return normalized embedding for storage if requested
  if (normalize) {
    return EmbeddingNormalizer.normalize(embedding, provider);
  }

  // Return original embedding for compatibility
  return embedding;
};

// Get the raw embedding without normalization (for compatibility)
export const embedRaw = async (input: string): Promise<number[]> => {
  return embed(input, false);
};

// Get the normalized embedding for storage
export const embedNormalized = async (input: string): Promise<number[]> => {
  return embed(input, true);
};

// Get current provider
export function getCurrentProvider(): EmbeddingProvider {
  return (process.env.AI_PROVIDER === 'gemini') ? 'gemini' : 'openai';
}

// Get current model being used
export function getCurrentModel(): string {
  const provider = getCurrentProvider();
  
  if (provider === 'gemini') {
    return process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
  } else {
    return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }
}

// Get embedding metadata for the current configuration
export function getEmbeddingInfo() {
  const provider = getCurrentProvider();
  const model = getCurrentModel();
  const expectedDims = EmbeddingNormalizer.getExpectedDimensions(provider);
  
  return {
    provider,
    model,
    expectedDimensions: expectedDims,
    normalizedDimensions: 3072,
    recommendations: EmbeddingNormalizer.getRecommendedModels()[provider],
  };
}
