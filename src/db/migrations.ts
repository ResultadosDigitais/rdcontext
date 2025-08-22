import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootPath } from '../utils/package';
import { migrate as execute } from 'drizzle-orm/libsql/migrator';
import { db } from './db';
import { library } from './schema-v2';

export const migrate = async () => {
  // For built applications, check if migrations exist in multiple possible locations
  const possiblePaths = [
    path.join(rootPath, 'migrations'),  // Original logic
    path.join(process.cwd(), 'migrations'), // Current working directory
    path.join(path.dirname(process.argv[1]), 'migrations'), // Next to the executable
  ];
  
  let migrationsPath = possiblePaths[0]; // Default fallback
  
  // Find the first path that exists
  for (const possiblePath of possiblePaths) {
    try {
      const { existsSync } = await import('node:fs');
      if (existsSync(possiblePath)) {
        migrationsPath = possiblePath;
        break;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.log(`📁 Using migrations path: ${migrationsPath}`);
  
  try {
    // Check what migration files exist
    const { existsSync, readdirSync } = await import('node:fs');
    if (existsSync(migrationsPath)) {
      const files = readdirSync(migrationsPath);
      console.log(`📂 Found migration files: ${files.join(', ')}`);
      
      console.log(`🔄 Applying migrations...`);
      const result = await execute(db, { migrationsFolder: migrationsPath });
      console.log(`✅ Migrations applied successfully`);
    } else {
      console.log(`❌ Migrations directory does not exist: ${migrationsPath}`);
      console.log(`🚀 Creating tables directly as fallback...`);
      await createTablesDirectly();
    }
    
    // Verify tables were created using proper LibSQL methods
    try {
      const { sql } = await import('drizzle-orm');
      const tablesResult = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = tablesResult.map((row: any) => row.name);
      console.log(`📋 Database tables after migration: ${tableNames.join(', ')}`);
      
      // Ensure required tables exist
      const requiredTables = ['libraries', 'snippets', 'snippets_vec_fallback'];
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.log(`⚠️ Missing tables detected: ${missingTables.join(', ')}, creating them...`);
        await createTablesDirectly();
        
        // Re-verify
        const newTablesResult = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`);
        const newTableNames = newTablesResult.map((row: any) => row.name);
        console.log(`📋 Database tables after fallback setup: ${newTableNames.join(', ')}`);
      }
    } catch (tableCheckError) {
      console.log(`⚠️ Could not verify tables: ${tableCheckError instanceof Error ? tableCheckError.message : String(tableCheckError)}`);
      console.log(`🚀 Creating tables directly as fallback...`);
      await createTablesDirectly();
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    console.log(`🚀 Attempting to create tables directly as final fallback...`);
    try {
      await createTablesDirectly();
      return { success: true };
    } catch (fallbackError) {
      console.error(`❌ Fallback table creation also failed:`, fallbackError);
      throw error;
    }
  }
};

// Fallback function to create tables directly (similar to simple-setup-v2.js)
const createTablesDirectly = async () => {
  const { sql } = await import('drizzle-orm');
  
  try {
    // Create libraries table (if not exists)
    await db.run(sql.raw(`
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
    `));
    
    // Create unified snippets table
    await db.run(sql.raw(`
      CREATE TABLE IF NOT EXISTS snippets (
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
    `));
    
    // Create fallback vector table
    await db.run(sql.raw(`
      CREATE TABLE IF NOT EXISTS snippets_vec_fallback (
        snippet_id INTEGER PRIMARY KEY,
        embedding BLOB NOT NULL
      )
    `));
    
    // Create indexes (if not exists)
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS snippets_library_idx ON snippets (library)`));
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS snippets_provider_idx ON snippets (provider)`));
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS snippets_created_at_idx ON snippets (created_at)`));
    
    console.log(`✅ Tables created successfully via direct SQL`);
  } catch (error) {
    console.error(`❌ Direct table creation failed:`, error);
    throw error;
  }
};

export const clear = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Clear operation is not allowed in production environment');
  }

  await db.delete(library);
};
