// One origin rule for the REST API and Socket.IO.
// Development: any localhost / 127.0.0.1 port and file:// pages ("null") are allowed, plus CLIENT_ORIGIN.
// Production (NODE_ENV=production): only the origins listed in CLIENT_ORIGIN.
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const production = process.env.NODE_ENV === 'production';

export function originAllowed(origin) {
  if (!origin || origins.includes(origin)) return true;
  if (production) return false;
  return LOCAL.test(origin) || origin === 'null' || origins.length === 0;
}
export const corsOrigin = (origin, cb) => cb(null, originAllowed(origin));
