// Server-made notifications. They go into the same "notifs" table the student app already shows
// (shared_items), so they appear in the app's Notifications window with no extra frontend work.
// Optionally they are also pushed to the phone/browser (services/push.js).
import { query } from '../db/pool.js';
import { sendPush } from './push.js';

// One notification to everyone with a student account. `tag` makes it idempotent (same tag = sent once).
export async function notifyAllStudents({ tag, kind, title, body, url }) {
  const ts = Date.now();
  const { rows } = await query(
    `INSERT INTO shared_items (collection, item_key, owner_id, to_email, data)
     SELECT 'notifs', $1::text || '-' || u.id::text, NULL, lower(u.email),
            jsonb_build_object('id', $1::text || '-' || u.id::text, 'to', lower(u.email), 'kind', $2::text, 'title', $3::text, 'body', $4::text, 'ts', $5::bigint, 'read', false)
       FROM users u WHERE u.role = 'student'
     ON CONFLICT (collection, item_key) DO NOTHING
     RETURNING owner_id, to_email`, [tag, kind, title, body, ts]);
  if (!rows.length) return 0;
  const { rows: ids } = await query(`SELECT id FROM users WHERE role = 'student'`);
  await sendPush(ids.map((r) => r.id), { title, body, url, tag }).catch(() => {});
  return rows.length;
}

// One notification to one student.
export async function notifyStudent({ userId, email, tag, kind, title, body, url }) {
  const ts = Date.now(), key = `${tag}-${userId}`, to = String(email).toLowerCase();
  const data = { id: key, to, kind, title, body, ts, read: false };
  const { rowCount } = await query(
    `INSERT INTO shared_items (collection, item_key, owner_id, to_email, data) VALUES ('notifs', $1, NULL, $2, $3)
     ON CONFLICT (collection, item_key) DO NOTHING`, [key, to, JSON.stringify(data)]);
  if (rowCount) await sendPush([userId], { title, body, url, tag }).catch(() => {});
  return Boolean(rowCount);
}
