import OpenAI from 'openai';

// OpenAI client setup - only instantiated when needed
let openaiClient: OpenAI | null = null;

export const openai = {
  embeddings: {
    create: (params: any) => {
      if (!openaiClient) {
        openaiClient = new OpenAI();
      }
      return openaiClient.embeddings.create(params);
    },
  },
  chat: {
    completions: {
      parse: (params: any) => {
        if (!openaiClient) {
          openaiClient = new OpenAI();
        }
        return openaiClient.chat.completions.parse(params);
      },
    },
  },
};
