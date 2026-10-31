import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { attachCollaboration } from './realtime/collab.js';
import { corsOrigin } from './lib/cors.js';
import { app } from './app.js';
import { expireStale } from './services/sessions.js';
import { query } from './db/pool.js';

// Fail fast with a readable message instead of a 500 on the first login.
for (const k of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[k]) { console.error(`Missing ${k}. Copy .env.example to .env and fill it in (see backend/README.md).`); process.exit(1); }
}

const PORT = Number(process.env.PORT || 4000);

// Exported so Lane C can attach Socket.IO to the same server (realtime/socket.js).
export const server = http.createServer(app);

// Virtual classroom: shared editor, whiteboard and chat (Socket.IO, same port as the API).
export const io = new SocketIOServer(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] }, maxHttpBufferSize: 1e6 });
attachCollaboration(io);

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Stop the other server or set PORT in .env.` : err);
  process.exit(1);
});
server.listen(PORT, () => console.log(`API on :${PORT}  (try http://localhost:${PORT}/health)`));
// Tell the developer right away if the database cannot be reached or was never migrated.
// (A refused connection arrives as an AggregateError with an empty message, so dig out the real reason.)
function dbReason(err) {
  const e = err?.errors?.[0] || err;
  const where = (() => { try { const u = new URL(process.env.DATABASE_URL); return `${u.hostname}:${u.port || 5432}`; } catch { return 'DATABASE_URL (not a valid URL)'; } })();
  if (e?.code === '42P01') return 'tables are missing. Run "npm run db:migrate" and then "npm run db:seed".';
  if (e?.code === 'ECONNREFUSED') return `nothing is listening on ${where}. Start PostgreSQL, or put your hosted database URL in DATABASE_URL.`;
  if (e?.code === 'ENOTFOUND') return `host not found (${where}). Check DATABASE_URL and your internet connection.`;
  if (e?.code === '28P01') return 'wrong database username or password in DATABASE_URL.';
  if (e?.code === '3D000') return 'that database does not exist. Create it, or fix the name in DATABASE_URL.';
  return `${e?.code || ''} ${e?.message || err} (target ${where})`.trim();
}
query('SELECT COUNT(*)::int AS n FROM users').then(
  ({ rows }) => console.log(`Database OK (${rows[0].n} users). Run "npm run db:seed" for the demo accounts.`),
  (err) => console.error(`Database problem: ${dbReason(err)}`)
);

// Expire stale requests / release stuck escrow every minute.
setInterval(() => {
  expireStale().catch((err) => console.error('expireStale failed', err));
}, 60_000);
