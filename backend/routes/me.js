import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as ledger from '../services/ledger.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, role, level, languages, bio, rating_avg, rating_count, sessions_given, created_at
       FROM users WHERE id = $1`, [req.userId]
  );
  if (!rows.length) throw new AppError(404, 'USER_NOT_FOUND');
  const balance = await ledger.getBalance(pool, req.userId);
  const { rows: held } = await query(
    `SELECT COALESCE(-SUM(l.delta), 0)::int AS held
       FROM credit_ledger l
       JOIN sessions s ON l.ref_type = 'session' AND l.ref_id = s.id
      WHERE l.user_id = $1 AND l.reason = 'hold' AND s.status IN ('accepted','in_progress')`,
    [req.userId]
  );
  res.json({ ...rows[0], balance, creditsInEscrow: held[0].held });
}));

router.get('/ledger', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, delta, reason, ref_type, ref_id, created_at
       FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 200`,
    [req.userId]
  );
  res.json({ balance: await ledger.getBalance(pool, req.userId), entries: rows });
}));

export default router;
