import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { ah } from '../lib/async.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_OPEN = 60;
const idParam = z.coerce.number().int().positive();
const slotSchema = z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date() });

// A tutor's own upcoming times (booked ones too, so they can see what is taken).
router.get('/mine', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, starts_at, ends_at, is_booked FROM availability_slots
      WHERE user_id = $1 AND ends_at > now() ORDER BY starts_at LIMIT 200`, [req.userId]);
  res.json(rows);
}));

router.post('/', ah(async (req, res) => {
  const { startsAt, endsAt } = slotSchema.parse(req.body);
  const mins = (endsAt - startsAt) / 60000;
  if (!(startsAt > new Date())) throw new AppError(400, 'SLOT_IN_PAST', 'pick a time in the future');
  if (mins < 15 || mins > 240) throw new AppError(400, 'SLOT_LENGTH', 'a slot must be between 15 minutes and 4 hours');
  const { rows: cnt } = await query('SELECT COUNT(*)::int AS n FROM availability_slots WHERE user_id = $1 AND ends_at > now()', [req.userId]);
  if (cnt[0].n >= MAX_OPEN) throw new AppError(400, 'TOO_MANY_SLOTS', `you can have at most ${MAX_OPEN} upcoming slots`);
  const { rows: clash } = await query(
    'SELECT 1 FROM availability_slots WHERE user_id = $1 AND starts_at < $3 AND ends_at > $2 LIMIT 1', [req.userId, startsAt, endsAt]);
  if (clash.length) throw new AppError(409, 'SLOT_OVERLAP', 'that overlaps a slot you already added');
  const { rows } = await query(
    'INSERT INTO availability_slots (user_id, starts_at, ends_at) VALUES ($1,$2,$3) RETURNING id, starts_at, ends_at, is_booked',
    [req.userId, startsAt, endsAt]);
  res.status(201).json(rows[0]);
}));

// Only your own, and only while nobody has booked it.
router.delete('/:id', ah(async (req, res) => {
  const { rows } = await query(
    'DELETE FROM availability_slots WHERE id = $1 AND user_id = $2 AND is_booked = false RETURNING id',
    [idParam.parse(req.params.id), req.userId]);
  if (!rows.length) throw new AppError(404, 'SLOT_NOT_FOUND', 'slot not found, or already booked');
  res.json({ deleted: true });
}));

export default router;
