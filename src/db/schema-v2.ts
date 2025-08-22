import { sql } from 'drizzle-orm';
import { int, sqliteTable, text, real, blob } from 'drizzle-orm/sqlite-core';

// Libraries table (unchanged - stores metadata about indexed repositories)
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

// Unified snippets table (metadata only - no embeddings stored here)
export const snippet = sqliteTable('snippets', {
  id: int('id').primaryKey({ autoIncrement: true }),
  library: text('library')
    .references(() => library.name, { onDelete: 'cascade' })
    .notNull(),
  path: text('path').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  language: text('language'),
  code: text('code').notNull(),
  provider: text('provider').notNull(), // 'openai' | 'gemini'
  embedding_dims: int('embedding_dims').notNull(), // 1536 | 3072
  created_at: text('created_at').notNull().default(sql`(current_timestamp)`),
});

// Fallback vector table for when sqlite-vec is not available
export const snippetVecFallback = sqliteTable('snippets_vec_fallback', {
  snippet_id: int('snippet_id').primaryKey(),
  embedding: blob('embedding').notNull(),
});

// Re-export db for compatibility
export { db } from './db';

// Type definitions for the new unified schema
export type Library = typeof library.$inferSelect;
export type CreateLibrary = typeof library.$inferInsert;
export type Snippet = typeof snippet.$inferSelect;
export type CreateSnippet = typeof snippet.$inferInsert;

// sqlite-vec virtual table will be created via raw SQL
// We'll define the interface here for TypeScript support
export interface VectorRecord {
  snippet_id: number;
  embedding: Float32Array;
}

// Embedding dimension constants
export const EMBEDDING_DIMS = {
  OPENAI: 1536,
  GEMINI: 3072,
  NORMALIZED: 3072, // Common dimension for cross-provider comparison
} as const;

// Provider types
export type EmbeddingProvider = 'openai' | 'gemini';

// Normalized embedding type for cross-provider compatibility
export interface NormalizedEmbedding {
  original: number[];
  normalized: number[]; // Always 3072 dimensions
  provider: EmbeddingProvider;
  dimensions: number;
}