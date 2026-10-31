// Saves what the frontend apps keep in the browser into the database, and reads it back on the next sign-in.
//   GET  /state                         everything this account may see (own data + shared data)
//   GET  /state/shared                  only the shared part (polled every few seconds for chat and notifications)
//   PUT  /state/private/:key            save one private blob
//   PUT  /state/shared/:collection/:key save one shared item (profile, chat thread, notification)
import express, { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const norm = (e) => String(e || '').trim().toLowerCase();
const KEY = /^[\w.:@+-]{1,160}$/;
const ITEM = /^[\w.:@+|-]{1,330}$/;

async function myEmail(userId) {
  const { rows } = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw new AppError(401, 'USER_NOT_FOUND', 'This account no longer exists. Please sign in again.');
  return norm(rows[0].email);
}

// Shared data this account is allowed to see.
// `since` (ISO time, optional): only rows changed after it, so the 5-second poll does not resend every profile photo.
async function readShared(email, since) {
  const when = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;
  const { rows } = await query(
    `SELECT collection, item_key, data FROM shared_items
      WHERE (collection = 'profiles'
         OR (collection IN ('notifs','tnotifs') AND to_email = $1)
         OR (collection = 'chats' AND (split_part(item_key, '|', 1) = $1 OR split_part(item_key, '|', 2) = $1)))
        AND ($2::timestamptz IS NULL OR updated_at > $2)
      ORDER BY updated_at`, [email, when]);
  const out = { profiles: {}, chats: {}, notifs: [], tnotifs: [] };
  for (const r of rows) {
    if (r.collection === 'notifs' || r.collection === 'tnotifs') out[r.collection].push(r.data);
    else out[r.collection][r.item_key] = r.data;
  }
  return out;
}

router.get('/', ah(async (req, res) => {
  const email = await myEmail(req.userId);
  const { rows } = await query('SELECT key, data FROM user_state WHERE user_id = $1', [req.userId]);
  const state = {};
  for (const r of rows) state[r.key] = r.data;
  res.json({ email, state, shared: await readShared(email), at: new Date().toISOString() });
}));

router.get('/shared', ah(async (req, res) => {
  res.json({ shared: await readShared(await myEmail(req.userId), req.query.since), at: new Date().toISOString() });
}));

const blob = z.object({ data: z.any().refine((v) => v !== undefined && v !== null, 'data is required') });

router.put('/private/:key', ah(async (req, res) => {
  if (!KEY.test(req.params.key)) throw new AppError(400, 'VALIDATION', 'Bad key.');
  const { data } = blob.parse(req.body);
  await query(
    `INSERT INTO user_state (user_id, key, data) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [req.userId, req.params.key, JSON.stringify(data)]);
  res.json({ ok: true });
}));

/* ---- shared items: each collection has its own "who may write" and "how two writers merge" rule ---- */
const msgId = (m) => `${m.ts}|${m.from}|${m.text}`;

router.put('/shared/:collection/:key', ah(async (req, res) => {
  const { collection, key } = req.params;
  if (!['profiles', 'chats', 'notifs', 'tnotifs'].includes(collection)) throw new AppError(404, 'NOT_FOUND', 'Unknown collection.');
  if (!ITEM.test(key)) throw new AppError(400, 'VALIDATION', 'Bad key.');
  const email = await myEmail(req.userId);
  const { data } = blob.parse(req.body);
  if (typeof data !== 'object' || Array.isArray(data)) throw new AppError(400, 'VALIDATION', 'data must be an object.');

  const { rows: old } = await query('SELECT data, owner_id, to_email FROM shared_items WHERE collection = $1 AND item_key = $2', [collection, key]);
  const prev = old[0];
  let next, ownerId = req.userId, toEmail = null;

  if (collection === 'profiles') {
    if (norm(key) !== email) throw new AppError(403, 'FORBIDDEN', 'You can only change your own profile.');
    next = data;
  } else if (collection === 'chats') {
    const [a, b] = key.split('|');
    if (email !== norm(a) && email !== norm(b)) throw new AppError(403, 'FORBIDDEN', 'This chat is not yours.');
    const msgs = new Map();
    for (const m of [...(prev?.data.msgs || []), ...(Array.isArray(data.msgs) ? data.msgs : [])]) {
      if (m && typeof m.text === 'string' && m.ts && (m.from === 'student' || m.from === 'tutor')) msgs.set(msgId(m), m);
    }
    const seenA = prev?.data.seen || {}, seenB = data.seen || {};
    next = {
      id: key,
      msgs: [...msgs.values()].sort((x, y) => x.ts - y.ts).slice(-200),
      seen: { student: Math.max(+seenA.student || 0, +seenB.student || 0), tutor: Math.max(+seenA.tutor || 0, +seenB.tutor || 0) },
    };
    ownerId = prev?.owner_id ?? req.userId;
  } else {                                                   // notifs / tnotifs
    if (prev) {
      // only the person it was sent to may change it, and only to mark it read
      if (prev.to_email !== email) throw new AppError(403, 'FORBIDDEN', 'Not your notification.');
      next = { ...prev.data, read: !!(prev.data.read || data.read) };
      toEmail = prev.to_email; ownerId = prev.owner_id;
    } else {
      toEmail = norm(data.to);
      if (!toEmail) throw new AppError(400, 'VALIDATION', 'Notification needs a recipient.');
      next = { ...data, to: toEmail, id: key };
    }
  }

  await query(
    `INSERT INTO shared_items (collection, item_key, owner_id, to_email, data) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (collection, item_key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [collection, key, ownerId, toEmail, JSON.stringify(next)]);
  res.json({ ok: true, data: next });
}));

/* ---- intro video: raw bytes in, raw bytes out ---- */
const MAX_VIDEO = 100 * 1024 * 1024;
router.put('/video', express.raw({ type: () => true, limit: MAX_VIDEO }), ah(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!/^video\/[\w.+-]+$/.test(mime)) throw new AppError(400, 'VALIDATION', 'Send a video file.');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError(400, 'VALIDATION', 'The video is empty.');
  await query(
    `INSERT INTO tutor_videos (user_id, mime, data) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()`,
    [req.userId, mime, req.body]);
  res.json({ ok: true });
}));
router.delete('/video', ah(async (req, res) => {
  await query('DELETE FROM tutor_videos WHERE user_id = $1', [req.userId]);
  res.json({ ok: true });
}));
router.get('/video/:email', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT v.mime, v.data FROM tutor_videos v JOIN users u ON u.id = v.user_id WHERE u.email = $1`, [norm(req.params.email)]);
  if (!rows.length) throw new AppError(404, 'NO_VIDEO', 'No intro video.');
  res.set('Content-Type', rows[0].mime).set('Cache-Control', 'private, max-age=60').send(rows[0].data);
}));

export default router;
