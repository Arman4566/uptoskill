import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withTx, query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { ah } from '../lib/async.js';
import { signToken } from '../middleware/auth.js';
import * as ledger from '../services/ledger.js';

const STARTER_CREDITS = Number(process.env.STARTER_CREDITS || 10);
const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(100),
  languages: z.array(z.string().max(30)).max(5).default([]),
});

router.post('/register', ah(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(body.password, 10);
  try {
    // User row and starter-credit ledger row commit together or not at all.
    const user = await withTx(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO users (name, email, password_hash, languages)
         VALUES ($1, $2, $3, $4) RETURNING id, name, email, level, languages`,
        [body.name, body.email.toLowerCase(), hash, body.languages]
      );
      if (STARTER_CREDITS > 0) { // ledger rows must be non-zero; 0 means "no free credits"
        await ledger.credit(c, {
          userId: rows[0].id, amount: STARTER_CREDITS, reason: 'starter', refType: 'user', refId: rows[0].id,
        });
      }
      return rows[0];
    });
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'EMAIL_TAKEN');
    throw err;
  }
}));

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query(
    'SELECT id, name, email, level, languages, password_hash FROM users WHERE email = $1 AND is_platform = false',
    [email.toLowerCase()]
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new AppError(401, 'BAD_CREDENTIALS');
  }
  const { password_hash, ...user } = row; // eslint-disable-line no-unused-vars
  res.json({ user, token: signToken(user) });
}));

export default router;
