// Weekly events (AI quiz + AI coding battle) and the push-notification subscription.
//   GET  /events                  this week's events (with my result + top 5), last weeks' results
//   GET  /events/:id              one event: full leaderboard, quiz review once it has ended
//   POST /events/:id/submit       quiz: { answers:[0..3] }   coding: { solutions:[{lang,code} x3] }
//   GET  /events/push/key         public VAPID key (or null when push is not set up)
//   POST /events/push/subscribe   save this browser's push subscription
//   POST /events/push/unsubscribe forget it
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as events from '../services/events.js';
import { pushPublicKey, pushReady } from '../services/push.js';

const router = Router();
router.use(requireAuth);
const idParam = z.coerce.number().int().positive();

/* push first, so "push" is never read as an event id */
router.get('/push/key', ah(async (req, res) => {
  const ready = await pushReady();
  res.json({ key: ready ? pushPublicKey() : null });
}));

router.post('/push/subscribe', ah(async (req, res) => {
  const b = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).parse(req.body);
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`, [req.userId, b.endpoint, b.keys.p256dh, b.keys.auth]);
  res.status(201).json({ ok: true });
}));

router.post('/push/unsubscribe', ah(async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.userId]);
  res.json({ ok: true });
}));

router.get('/', ah(async (req, res) => { res.json(await events.listForStudent(req.userId)); }));
router.get('/:id', ah(async (req, res) => { res.json(await events.detail(req.userId, idParam.parse(req.params.id))); }));
router.post('/:id/submit', ah(async (req, res) => { res.status(201).json(await events.submit(req.userId, idParam.parse(req.params.id), req.body)); }));

export default router;
