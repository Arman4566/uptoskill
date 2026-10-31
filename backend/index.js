import http from 'node:http';
import { app } from './app.js';
import { expireStale } from './services/sessions.js';

const PORT = Number(process.env.PORT || 4000);

// Exported so Lane C can attach Socket.IO to the same server (realtime/socket.js).
export const server = http.createServer(app);

server.listen(PORT, () => console.log(`API on :${PORT}`));

// Expire stale requests / release stuck escrow every minute.
setInterval(() => {
  expireStale().catch((err) => console.error('expireStale failed', err));
}, 60_000);
