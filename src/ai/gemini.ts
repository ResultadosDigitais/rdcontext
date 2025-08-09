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

  const prompt = `You are an expert technical writer and design systems specialist. Your job is to create concise, helpful descriptions for code snippets and style examples extracted from a design system documentation repository. These pieces of information will be used later to build a llms.txt file for the library.

For each snippet you find:
<goal>
- Identify the programming language or type (CSS, SCSS, JSON, JS, TSX, etc.)
- Extract a relevant snippet to demonstrate the functionality or concept
- Create a title that clearly describes what the snippet does
- Write a short description (1-2 sentences) explaining the snippet's purpose
- Ensure your title and description are helpful for AI IDEs like Cursor and Windsurf
</goal>

The titles should:
<title>
- Be clear, specific, and action-oriented
- Reflect real-world tasks (e.g. "Applying Brand Colors", "Using Icon Component", "Defining Border Radius Tokens")
- Be under 80 characters
</title>

The descriptions should:
<description>
- Explain the functionality, usage, or concept demonstrated
- Mention relevant components, design tokens, or style rules
- Be helpful for developers searching for specific UI patterns or utilities
- Be concise (max 200 characters)
</description>

<guidelines>
- Accept code blocks marked with triple backticks (\\\), fenced blocks with language tags, or indented code
- For design tokens or configuration files (JSON, SCSS, etc.), extract meaningful subsets that illustrate purpose (e.g. spacing scale, typography settings)
- Group snippets by functionality, not trivial operations (e.g. avoid isolated imports)
- Include visual usage examples if they show how to apply styles, icons, colors, or layout utilities
- Prioritize core components, tokens, or utilities over documentation boilerplate
</guidelines>

<design-system-specific>
- Pay special attention to files about foundations (colors, spacing, typography), icons (SVG or component usage), and style primitives
- Treat design tokens, style maps, and configuration objects as valuable content
- Consider CSS/SCSS/JSON/YAML/etc. as code when relevant to the system’s functionality
- Examples in Markdown (e.g. component usage shown within backticks or fenced blocks) are acceptable if they demonstrate usage
</design-system-specific>

<ignore>
Omit snippets that are:
- Documentation layout or wrapper components
- Storybook controls or presentation-only code
- Page structure elements used only for visual arrangement
- Pure markdown text not related to component usage
- Redundant import statements not essential to the snippet
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

Please respond with a valid JSON array of objects. Each object must have:
- title: string (objective title describing the feature)
- description: string (what the code does, max 2-3 sentences)
- language: string (programming language or config type, or empty if not applicable)
- code: string (the extracted snippet)

If no suitable snippets are found, return an empty array [].

JSON Response:
`;

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