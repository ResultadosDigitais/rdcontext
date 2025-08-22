import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { vectorStore } from './vector-store';
import { snippetStoreV2 } from './snippet-store-v2';

// Migration utility to transition from old architecture to 2025 optimized version
export class MigrationV2 {
  
  // Apply the 2025 optimized schema
  async applyOptimizedSchema(): Promise<void> {
    console.log('🚀 Applying 2025 optimized architecture...');
    
    const migrationPath = join(process.cwd(), 'migrations', '0001_optimized_2025.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        try {
          await db.run(sql.raw(statement));
          console.log(`✅ ${statement.substring(0, 50)}...`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Migration error:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Initialize sqlite-vec virtual table
    await vectorStore.init();
    
    console.log('✅ 2025 optimized schema applied successfully!');
  }

  // Migrate existing data from old provider tables (if they exist)
  async migrateExistingData(): Promise<{ migrated: number; errors: number }> {
    console.log('🔄 Checking for existing data to migrate...');
    
    let migrated = 0;
    let errors = 0;

    try {
      // Check if old tables exist and have data
      const oldTables = ['snippets_openai', 'snippets_gemini'];
      
      for (const tableName of oldTables) {
        try {
          const provider = tableName.includes('openai') ? 'openai' : 'gemini';
          
          // Check if table exists
          const tableExists = await db.all(sql.raw(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='${tableName}'
          `));
          
          if (tableExists.length === 0) {
            console.log(`📭 No ${tableName} table found - skipping`);
            continue;
          }

          // Get data from old table
          const oldData = await db.all(sql.raw(`SELECT * FROM ${tableName}`));
          
          if (oldData.length === 0) {
            console.log(`📭 No data in ${tableName} - skipping`);
            continue;
          }

          console.log(`📦 Found ${oldData.length} records in ${tableName}`);
          
          // Note: This is a simplified migration
          // In a real migration, you'd need to:
          // 1. Extract the embedding data from F32_BLOB format
          // 2. Convert to normalized format
          // 3. Store in new unified schema
          
          console.log(`⚠️  Automatic migration of embeddings not implemented`);
          console.log(`   Please re-index libraries to use the new optimized format`);
          
        } catch (error) {
          console.warn(`⚠️  Error checking ${tableName}:`, error.message);
          errors++;
        }
      }
      
    } catch (error) {
      console.error('❌ Migration error:', error);
      errors++;
    }

    return { migrated, errors };
  }

  // Complete migration process
  async migrate(): Promise<{
    success: boolean;
    schemaApplied: boolean;
    dataMigrated: { migrated: number; errors: number };
    healthCheck: any;
  }> {
    try {
      // Apply new schema
      await this.applyOptimizedSchema();
      const schemaApplied = true;
      
      // Migrate existing data
      const dataMigrated = await this.migrateExistingData();
      
      // Run health check
      const healthCheck = await snippetStoreV2.healthCheck();
      
      console.log('🎉 Migration to 2025 architecture completed!');
      console.log(`   📊 Schema: ✅ Applied`);
      console.log(`   📦 Data: ${dataMigrated.migrated} migrated, ${dataMigrated.errors} errors`);
      console.log(`   🏥 Health: ${healthCheck.status}`);
      
      return {
        success: true,
        schemaApplied,
        dataMigrated,
        healthCheck,
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        schemaApplied: false,
        dataMigrated: { migrated: 0, errors: 1 },
        healthCheck: { status: 'error', details: error.message },
      };
    }
  }

  // Clean up old tables (use with caution!)
  async cleanupOldTables(): Promise<void> {
    console.log('🧹 Cleaning up old provider-specific tables...');
    
    const oldTables = [
      'snippets_openai', 
      'snippets_gemini',
      'snippets' // Old snippets table if it exists
    ];
    
    for (const tableName of oldTables) {
      try {
        await db.run(sql.raw(`DROP TABLE IF EXISTS ${tableName}`));
        console.log(`🗑️  Dropped ${tableName}`);
      } catch (error) {
        console.warn(`⚠️  Could not drop ${tableName}:`, error.message);
      }
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Export migration instance
export const migrationV2 = new MigrationV2();