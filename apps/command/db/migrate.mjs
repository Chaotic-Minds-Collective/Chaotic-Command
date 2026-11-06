// Applies pending migrations from apps/command/db/migrations in filename order.
// Usage: node --env-file-if-exists=.env apps/command/db/migrate.mjs
import process from 'node:process';
import { openDb } from './index.mjs';

const db = await openDb();
console.log(`[migrate] driver: ${db.kind}`);
try {
  await db.migrate();
  console.log('[migrate] all migrations applied');
} finally {
  await db.close();
}
