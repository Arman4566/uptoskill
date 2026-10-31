import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Without a listener, an error on an idle connection (DB restart, network blip) crashes the whole process.
pool.on('error', (err) => console.error('idle database client error', err.message));

export const query = (text, params) => pool.query(text, params);

// Run fn(client) inside one transaction. Commit on success, rollback on any throw.
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
