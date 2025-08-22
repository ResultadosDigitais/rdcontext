import { geminiExtract } from './gemini';

export interface ExtractOptions {
  name: string;
  description: string | null;
  path: string;
  content: string;
}

export const extract = async ({
  name,
  description,
  path,
  content,
}: ExtractOptions) => {
  // Use Gemini for extraction
  return geminiExtract({ name, description, path, content });
};
