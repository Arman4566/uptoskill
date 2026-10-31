// Browser push (Web Push + VAPID). This is how a reminder reaches a student who has the website CLOSED.
// Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env (make them with:  npx web-push generate-vapid-keys).
// Without them the app still works: reminders are saved as in-app notifications and shown on the next visit.
import { query } from '../db/pool.js';

let lib; // undefined = not tried yet, false = unavailable
async function load() {
  if (lib !== undefined) return lib;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv) { lib = false; return lib; }
  try {
    const m = await import('web-push');
    lib = m.default || m;
    lib.setVapidDetails(subject || 'mailto:admin@uptoskill.local', pub, priv);
  } catch (err) { console.error('web-push is not installed or the VAPID keys are bad:', err.message); lib = false; }
  return lib;
}

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';
export const pushReady = async () => Boolean(await load());

// payload = { title, body, url?, tag? }. Dead subscriptions (404/410) are removed. Never throws.
export async function sendPush(userIds, payload) {
  const wp = await load();
  if (!wp || !userIds.length) return 0;
  const { rows } = await query('SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::int[])', [userIds]);
  let sent = 0;
  const body = JSON.stringify({ title: String(payload.title || 'UpToSkill').slice(0, 80), body: String(payload.body || '').slice(0, 240), url: payload.url || '/student/app.html', tag: payload.tag || 'uts' });
  await Promise.all(rows.map(async (s) => {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600 });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
      else console.error('push failed:', err.statusCode || err.message);
    }
  }));
  return sent;
}
