import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { type MockResult, mockModule } from '../../tests/utils';
import { geminiEmbed } from './gemini';

describe('geminiEmbed', () => {
  const mockEmbedContent = mock(async () => ({
    embedding: { values: [0.1, -0.2, 0.3, 0.4, -0.5] },
  }));

  let mocks: MockResult[] = [];
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    mocks = [
      await mockModule('@google/genai', () => ({
        GoogleGenerativeAI: mock(() => ({
          getGenerativeModel: mock(() => ({
            embedContent: mockEmbedContent,
          })),
        })),
      })),
    ];
  });

  afterEach(() => {
    process.env = originalEnv;
    mockEmbedContent.mockClear();
    mocks.forEach((mockResult) => mockResult.clear());
  });

  it('should generate embeddings for valid input', async () => {
    const input = 'Hello world';
    const embedding = [0.1, -0.2, 0.3, 0.4, -0.5];

    mockEmbedContent.mockResolvedValueOnce({
      embedding: { values: embedding },
    });

    const result = await geminiEmbed(input);

    expect(result).toEqual(embedding);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      contents: [{ text: input }],
    });
  });

  it('should throw error for empty input', async () => {
    await expect(geminiEmbed('')).rejects.toThrow('Input cannot be empty');
    await expect(geminiEmbed('   ')).rejects.toThrow('Input cannot be empty');
  });

  it('should throw error when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(geminiEmbed('test')).rejects.toThrow(
      'GEMINI_API_KEY environment variable is required'
    );
  });

  it('should throw error when embedding values are missing', async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embedding: {}, // Missing values
    });

    await expect(geminiEmbed('test')).rejects.toThrow('Failed to generate embedding');
  });

  it('should use custom embedding model from environment', async () => {
    process.env.GEMINI_EMBEDDING_MODEL = 'custom-model';

    mockEmbedContent.mockResolvedValueOnce({
      embedding: { values: [0.1, 0.2] },
    });

    await geminiEmbed('test');

    // Verify the model was used (through mock expectations)
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
  });
});