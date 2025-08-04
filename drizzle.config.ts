import type { Config } from 'drizzle-kit';
import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';

// Replicate the exact same logic as the application
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const name = Object.keys(packageJson.bin)[0]; // 'libcontext'

const homedir = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
const dataPath = path.join(localAppData, name, 'Data');
const dbUrl = `file:${dataPath}/${name}.db`;

export default {
  schema: './src/db/schema-v2.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
  },
} satisfies Config;
