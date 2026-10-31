// Removes the old demo accounts (student@demo.com, tutor@demo.com, *@demo.test) and everything that belongs to them
// (sessions, credits, slots, saved app data ...; the foreign keys are ON DELETE CASCADE).
// Runs automatically at the end of `npm run db:migrate`, and can be run on its own: `npm run db:purge-demo`.
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

export async function purgeDemo(db = pool) {
  const { rows } = await db.query(`DELETE FROM users WHERE email ~* '@demo\\.(test|com)$' RETURNING email`);
  await db.query(`DELETE FROM shared_items WHERE item_key ~* '@demo\\.(test|com)' OR to_email ~* '@demo\\.(test|com)$'`);
  return rows.map((r) => r.email);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const gone = await purgeDemo(); console.log(gone.length ? `removed demo accounts: ${gone.join(', ')}` : 'no demo accounts found'); }
  catch (err) { console.error('purge failed:', err.message); process.exitCode = 1; }
  finally { await pool.end(); }
}
