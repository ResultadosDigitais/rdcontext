import { url } from './settings';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema-v2';

export const db = drizzle({
  schema,
  connection: { url },
});
