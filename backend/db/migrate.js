import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');

if (process.argv.includes('--reset')) {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('schema dropped');
}
await pool.query(sql);
console.log('schema applied');
await pool.end();
