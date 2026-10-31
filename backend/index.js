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
query('SELECT COUNT(*)::int AS n FROM users').then(
  ({ rows }) => console.log(`Database OK (${rows[0].n} users). Sign up on the website to create accounts.`),
  (err) => console.error(`Database problem: ${err.message}. Check DATABASE_URL, then run "npm run db:migrate".`)
);

// Expire stale requests / release stuck escrow every minute.
setInterval(() => {
  expireStale().catch((err) => console.error('expireStale failed', err));
}, 60_000);
