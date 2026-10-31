import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import { quoteFor, ALLOWED_MINUTES } from '../lib/price.js';

const router = Router();
router.use(requireAuth);

// Tutors the signed-in learner can book (a tutor must be above the learner's level), with the price of each lesson length.
router.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.level, u.bio, u.languages, u.rating_avg, u.rating_count, u.sessions_given,
            COALESCE(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills
       FROM users u
       LEFT JOIN user_skills us ON us.user_id = u.id
       LEFT JOIN skills s ON s.id = us.skill_id
      WHERE u.is_platform = false AND u.id <> $1
        AND u.level > (SELECT level FROM users WHERE id = $1)
      GROUP BY u.id ORDER BY u.level DESC, u.rating_avg DESC LIMIT 100`, [req.userId]
  );
  const prices = ALLOWED_MINUTES.booked.map((minutes) => ({ minutes, ...quoteFor(minutes) }));
  res.json({ prices, mentors: rows });
}));

// Open times a tutor has added (future, not booked), for the booking form.
router.get('/:id/slots', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, starts_at, ends_at FROM availability_slots
      WHERE user_id = $1 AND is_booked = false AND starts_at > now() ORDER BY starts_at LIMIT 100`,
    [Number(req.params.id) || 0]);
  res.json(rows);
}));

export default router;
