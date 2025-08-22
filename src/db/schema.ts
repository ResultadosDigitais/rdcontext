import { sql } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { f32 } from './types';

export const library = sqliteTable('libraries', {
  name: text('name').notNull().primaryKey(),
  description: text('description'),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  ref: text('ref').notNull(),
  sha: text('sha').notNull(),
  folders: text('folders', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`(json_array())`),
  files: int('files').default(0),
  snippets: int('snippets').default(0),
  timestamp: text('timestamp').notNull().default(sql`(current_timestamp)`),
});
export type Library = typeof library.$inferSelect;
export type CreateLibrary = typeof library.$inferInsert;

// Base snippet schema shared by both providers
const baseSnippetSchema = {
  record: int('record').primaryKey({ autoIncrement: true }),
  library: text('library')
    .references(() => library.name, { onDelete: 'cascade' })
    .notNull(),
  path: text('path').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  language: text('language'),
  code: text('code').notNull(),
};

// OpenAI snippets with 1536-dimensional embeddings
export const snippetOpenAI = sqliteTable('snippets_openai', {
  ...baseSnippetSchema,
  embedding: f32('embedding', { dimensions: 1536 }),
});

// Gemini snippets with 3072-dimensional embeddings (optimal storage)
export const snippetGemini = sqliteTable('snippets_gemini', {
  ...baseSnippetSchema,
  embedding: f32('embedding', { dimensions: 3072 }),
});

export type SnippetOpenAI = typeof snippetOpenAI.$inferSelect;
export type SnippetGemini = typeof snippetGemini.$inferSelect;
export type CreateSnippetOpenAI = typeof snippetOpenAI.$inferInsert;
export type CreateSnippetGemini = typeof snippetGemini.$inferInsert;

// Union type for any snippet
export type Snippet = (SnippetOpenAI | SnippetGemini) & { provider: 'openai' | 'gemini' };
export type CreateSnippet = (CreateSnippetOpenAI | CreateSnippetGemini) & { provider: 'openai' | 'gemini' };
