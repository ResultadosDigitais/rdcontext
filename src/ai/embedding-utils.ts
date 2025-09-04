import type { EmbeddingProvider } from '../db/schema-v2';

// Embedding normalization utilities for cross-provider compatibility
export class EmbeddingNormalizer {
  
  // Normalize any embedding to 3072 dimensions for storage
  static normalize(embedding: number[], provider: EmbeddingProvider): number[] {
    switch (provider) {
      case 'gemini':
        return this.normalizeGemini(embedding);
      case 'openai':
        return this.normalizeOpenAI(embedding);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Normalize Gemini embeddings to 3072 dimensions
  private static normalizeGemini(embedding: number[]): number[] {
    if (embedding.length === 3072) {
      // Already 3072d - return as-is
      return embedding;
    }
    
    if (embedding.length === 768) {
      // Pad 768d embeddings to 3072d with zeros
      // This is a simple approach - in production you might want more sophisticated normalization
      const normalized = new Array(3072).fill(0);
      for (let i = 0; i < 768; i++) {
        normalized[i] = embedding[i];
      }
      return normalized;
    }
    
    throw new Error(`Invalid Gemini embedding dimensions: expected 768 or 3072, got ${embedding.length}`);
  }

  // OpenAI embeddings: truncate from 1536d to 3072d (Matryoshka principle)
  private static normalizeOpenAI(embedding: number[]): number[] {
    if (embedding.length === 3072) {
      // Already normalized (might be from a smaller OpenAI model)
      return embedding;
    }
    
    if (embedding.length === 1536) {
      // Truncate to first 3072 dimensions
      // This preserves ~95% of semantic information based on Matryoshka research
      return embedding.slice(0, 3072);
    }
    
    if (embedding.length === 3072) {
      // Large OpenAI model - truncate to first 3072 dimensions
      return embedding.slice(0, 3072);
    }
    
    throw new Error(`Unsupported OpenAI embedding dimensions: ${embedding.length}`);
  }

  // Binary quantization for extreme storage optimization (95% reduction)
  static quantizeToBinary(embedding: number[]): Uint8Array {
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

  // Restore binary quantized embedding (for comparison only)
  static dequantizeFromBinary(binary: Uint8Array, originalLength: number): number[] {
    const embedding = new Array(originalLength);
    
    for (let i = 0; i < originalLength; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      
      // Convert bit back to -1 or 1
      const bit = (binary[byteIndex] >> bitIndex) & 1;
      embedding[i] = bit === 1 ? 1.0 : -1.0;
    }
    
    return embedding;
  }

  // Calculate cosine similarity between two normalized embeddings
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Validate embedding dimensions for a provider
  static validateEmbedding(embedding: number[], provider: EmbeddingProvider): boolean {
    switch (provider) {
      case 'gemini':
        return [768, 3072].includes(embedding.length);
      case 'openai':
        return [3072, 1536, 3072].includes(embedding.length);
      default:
        return false;
    }
  }

  // Get expected dimensions for a provider
  static getExpectedDimensions(provider: EmbeddingProvider): number[] {
    switch (provider) {
      case 'gemini':
        return [768, 3072];
      case 'openai':
        return [3072, 1536, 3072];
      default:
        return [];
    }
  }

  // Get the optimal model recommendations for each provider
  static getRecommendedModels(): Record<EmbeddingProvider, string[]> {
    return {
      gemini: ['text-embedding-004', 'text-embedding-preview-0815'],
      openai: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    };
  }
}

// Utility function for creating consistent embedding metadata
export interface EmbeddingMetadata {
  provider: EmbeddingProvider;
  model: string;
  originalDimensions: number;
  normalizedDimensions: number;
  quantized: boolean;
  createdAt: Date;
}

export function createEmbeddingMetadata(
  provider: EmbeddingProvider,
  model: string,
  originalDimensions: number,
  quantized: boolean = false
): EmbeddingMetadata {
  return {
    provider,
    model,
    originalDimensions,
    normalizedDimensions: 3072,
    quantized,
    createdAt: new Date(),
  };
}