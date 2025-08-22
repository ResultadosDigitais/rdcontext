import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { type MockResult, mockModule } from '../../tests/utils';
import { embed } from './embed';

describe('embed', () => {
  const create = mock(async () => ({
    data: [{ embedding: [0.1, -0.2, 0.3, 0.4, -0.5] }],
  }));

  const geminiEmbedContent = mock(async () => ({
    embedding: { values: [0.1, -0.2, 0.3, 0.4, -0.5] },
  }));

  let mocks: MockResult[] = [];
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    mocks = [
      await mockModule('./openai', () => ({
        openai: {
          embeddings: { create },
        },
      })),
      await mockModule('@google/genai', () => ({
        GoogleGenAI: mock(() => ({
          getGenerativeModel: mock(() => ({
            embedContent: geminiEmbedContent,
          })),
        })),
      })),
    ];
  });

  afterEach(() => {
    process.env = originalEnv;
    create.mockClear();
    geminiEmbedContent.mockClear();
    mocks.forEach((mockResult) => mockResult.clear());
  });

  it('should handle empty inputs', async () => {
    expect(embed('')).rejects.toThrow('Input cannot be empty');
  });

  describe('OpenAI provider (default)', () => {
    it('should return embedding array for valid input', async () => {
      // Arrange
      const input = 'Hello world';
      const embedding = [0.1, -0.2, 0.3, 0.4, -0.5];

      create.mockResolvedValueOnce({
        data: [{ embedding }],
      });

      // Act
      const result = await embed(input);

      // Assert
      expect(result).toEqual(embedding);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: input,
      });
    });

    it('should use custom OpenAI embedding model from env', async () => {
      process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';
      
      const input = 'Hello world';
      const embedding = [0.1, -0.2, 0.3, 0.4, -0.5];

      create.mockResolvedValueOnce({
        data: [{ embedding }],
      });

      await embed(input);

      expect(create).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: input,
      });
    });
  });

  describe('Gemini provider', () => {
    beforeEach(() => {
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test-key';
    });

    it('should use Gemini when AI_PROVIDER is set to gemini', async () => {
      const input = 'Hello world';
      const embedding = [0.1, -0.2, 0.3, 0.4, -0.5];

      geminiEmbedContent.mockResolvedValueOnce({
        embedding: { values: embedding },
      });

      const result = await embed(input);

      expect(result).toEqual(embedding);
      expect(geminiEmbedContent).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    });

    it('should handle Gemini API errors', async () => {
      geminiEmbedContent.mockResolvedValueOnce({
        embedding: {}, // Missing values
      });

      await expect(embed('test')).rejects.toThrow('Failed to generate embedding');
    });
  });
});
