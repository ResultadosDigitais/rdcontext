import { GoogleGenAI } from '@google/genai';

// Gemini client setup - only instantiated when needed
let geminiClient: GoogleGenAI | null = null;

const getGeminiClient = () => {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
};

export const geminiEmbed = async (input: string): Promise<number[]> => {
  if (!input?.trim()) {
    throw new Error('Input cannot be empty');
  }

  const client = getGeminiClient();
  
  try {
    const result = await client.models.embedContent({
      model: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
      contents: [input],
    });

    // Clean response handling

    // Check different possible response structures
    if (result.embedding?.values) {
      return result.embedding.values;
    }
    
    if (result.embeddings?.[0]?.values) {
      return result.embeddings[0].values;
    }
    
    if (Array.isArray(result.embedding)) {
      return result.embedding;
    }

    throw new Error(`Unexpected embedding response structure: ${JSON.stringify(result)}`);
  } catch (error) {
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

interface ExtractedSnippet {
  title: string;
  description: string;
  language: string;
  code: string;
}

export const geminiExtract = async ({
  name,
  description,
  path,
  content,
}: {
  name: string;
  description: string | null;
  path: string;
  content: string;
}): Promise<ExtractedSnippet[]> => {
  if (!content?.trim()) {
    return [];
  }

  const client = getGeminiClient();

  const prompt = `You are an expert technical writer. Your job is to create concise, helpful descriptions for code snippets extracted from a library's documentation repo. These pieces of information will be used later to build a \`llms.txt\` file for the library.

For each code snippet you find:
<goal>
- Identify the programming language
- Extract a relevant code snippet to display the functionality
- Create title that describes what the code does
- Write a brief description (2-3 sentences) explaining the code's purpose
- Keep in mind that the title and description you write MUST be helpful for AI IDEs, like Cursor and Windsurf.
</goal>

The titles should:
<title>
- Be descriptive and specific (not generic like "Code Example")
- Be action-oriented when possible (e.g. "Installing Package via CLI", "Rendering Button Component")
- Be under 80 characters
</title>

The descriptions should:
<description>
- Explain what the code does and its purpose
- Mention key components/functions/concepts
- Be helpful for someone searching for similar functionality
- Be 1-2 sentences, under 200 characters
</description>

<guidelines>
- Look for code blocks marked with triple backticks (\`\`\`) or indented code blocks
- Group code snippets by their functionality: be careful to not generate snippets that are too narrow (eg. how to import a component)
- Extract ONLY the core library functionality, stripping away documentation wrapper elements
- Focus on the actual library components being demonstrated, not how they're presented in the docs
- If the file does not contain any code snippets, return an empty list
- It is not necessary to include the library name in the title or description, as it is already known
</guidelines>

<ignore>
You should omit parts of the code that are:
- Documentation layout components
- Storybook wrappers and controls
- Page structure elements (e.g. containers, wrappers purely for documentation display)
- Not relevant to the library's functionality
- Not in a programming language (e.g. plain text or markdown)
- Inline code snippets (single backticks), unless it highlights an important feature
- Import statements for documentation/layout components
</ignore>

You are currently analyzing the following library:
<library>
Name: ${name}
Description: ${description || 'No description'}
</library>

Here are the contents of the file to analyze now (${path}):
<file>
${content}
</file>

Please respond with a valid JSON array of objects. Each object should have exactly these fields:
- title: string (objective title describing the feature)
- description: string (explanation of what the code does, 2-3 sentences max)
- language: string (programming language, empty string if not applicable)
- code: string (the extracted code snippet)

If no code snippets are found, return an empty array [].

JSON Response:`;

  const result = await client.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-pro',
    contents: prompt,
    config: {
      temperature: 0,
      topK: 1,
      topP: 1,
      responseMimeType: 'application/json',
    },
  });

  if (!result.text) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.text);
    if (!Array.isArray(parsed)) {
      console.warn('Gemini response is not an array');
      return [];
    }

    // Validate and clean the response
    return parsed.filter((snippet: any) => 
      snippet && 
      typeof snippet.title === 'string' &&
      typeof snippet.description === 'string' &&
      typeof snippet.language === 'string' &&
      typeof snippet.code === 'string'
    );
  } catch (error) {
    console.warn('Failed to parse Gemini response as JSON:', error);
    return [];
  }
};