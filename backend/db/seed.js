import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, 'seed.sql'), 'utf8');

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.test')::int AS users,
            (SELECT COUNT(*) FROM skills)::int AS skills,
            (SELECT COUNT(*) FROM availability_slots)::int AS slots`
  );
  console.log('seeded:', rows[0], '| demo password: demo1234 (e.g. riya@demo.test, neha@demo.test)');
} catch (err) {
  console.error('seed failed - did you run `npm run db:migrate` first?', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
