import { cpSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Build the application
await Bun.build({
  entrypoints: ['src/index.ts'],
  target: 'node',
  external: ['sury', 'effect', '@valibot/to-json-schema'],
  outdir: './dist',
});

// Copy migrations folder to dist
const migrationsSrc = './migrations';
const migrationsDest = './dist/migrations';

if (existsSync(migrationsSrc)) {
  console.log('📁 Copying migrations folder to dist...');
  if (existsSync(migrationsDest)) {
    // Remove existing migrations folder first
    await Bun.$`rm -rf ${migrationsDest}`;
  }
  cpSync(migrationsSrc, migrationsDest, { recursive: true });
  console.log('✅ Migrations copied successfully');
} else {
  console.warn('⚠️ No migrations folder found to copy');
}
