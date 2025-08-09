// Simple setup script for 2025 architecture
import { createClient } from '@libsql/client';
import { join } from 'path';
import { mkdirSync } from 'fs';
import os from 'os';

// Use the same path logic as the actual app
const homedir = os.homedir();
const localAppData = process.env.LOCALAPPDATA || join(homedir, 'AppData', 'Local');
const dataPath = join(localAppData, 'rdcontext', 'Data');

mkdirSync(dataPath, { recursive: true });
const url = `file:${dataPath}/rdcontext.db`;

const client = createClient({ url });

console.log('🚀 Setting up 2025 Optimized Architecture...');

try {
  // Drop old tables
  await client.execute('DROP TABLE IF EXISTS snippets_openai');
  await client.execute('DROP TABLE IF EXISTS snippets_gemini');
  await client.execute('DROP TABLE IF EXISTS snippets');
  console.log('✅ Cleaned up old tables');

  // Create libraries table (if not exists)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS libraries (
      name text PRIMARY KEY NOT NULL,
      description text,
      owner text NOT NULL,
      repo text NOT NULL,
      ref text NOT NULL,
      sha text NOT NULL,
      folders text DEFAULT (json_array()) NOT NULL,
      files integer DEFAULT 0,
      snippets integer DEFAULT 0,
      timestamp text DEFAULT (current_timestamp) NOT NULL
    )
  `);
  console.log('✅ Libraries table ready');

  // Create unified snippets table
  await client.execute(`
    CREATE TABLE snippets (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      library text NOT NULL,
      path text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      language text,
      code text NOT NULL,
      provider text NOT NULL,
      embedding_dims integer NOT NULL,
      created_at text DEFAULT (current_timestamp) NOT NULL,
      FOREIGN KEY (library) REFERENCES libraries(name) ON DELETE cascade
    )
  `);
  console.log('✅ Unified snippets table created');

  // Create indexes
  await client.execute('CREATE INDEX snippets_library_idx ON snippets (library)');
  await client.execute('CREATE INDEX snippets_provider_idx ON snippets (provider)');
  await client.execute('CREATE INDEX snippets_created_at_idx ON snippets (created_at)');
  console.log('✅ Indexes created');

  // Create fallback vector table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS snippets_vec_fallback (
      snippet_id INTEGER PRIMARY KEY,
      embedding BLOB
    )
  `);
  console.log('✅ Vector fallback table created');

  console.log('🎉 2025 Architecture setup completed!');

} catch (error) {
  console.error('❌ Setup failed:', error);
} finally {
  client.close();
}