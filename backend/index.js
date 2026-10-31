import http from 'node:http';
import { app } from './app.js';
import { expireStale } from './services/sessions.js';
import { retryQueued, settleSimulated } from './services/payouts.js';

const PORT = Number(process.env.PORT || 4000);

// Exported so Lane C can attach Socket.IO to the same server (realtime/socket.js).
export const server = http.createServer(app);

server.listen(PORT, () => console.log(`API on :${PORT}`));

// Expire stale requests / release stuck escrow every minute.
setInterval(() => {
  expireStale().catch((err) => console.error('expireStale failed', err));
}, 60_000);

// Re-send withdrawals whose result we never heard back about (same idempotency key, so never paid twice).
setInterval(() => {
  retryQueued().catch((err) => console.error('retryQueued failed', err));
}, 60_000);

// The pretend bank finishes due withdrawals, so a payout visibly goes "on its way" -> "paid" a few seconds later.
let settling = false;
setInterval(async () => {
  if (settling) return;
  settling = true;
  try { await settleSimulated(); } catch (err) { console.error('settleSimulated failed', err); } finally { settling = false; }
}, 2_000);
