import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as payouts from '../services/payouts.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => res.json(await payouts.summary(req.userId))));

const accountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('upi'), upi: z.string().trim().regex(/^[\w.\-]{2,256}@[\w.\-]{2,64}$/, 'not a valid UPI id') }),
  z.object({
    kind: z.literal('bank'),
    name: z.string().trim().min(2).max(100),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'not a valid IFSC'),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'account number must be 9-18 digits'),
  }),
]);

router.put('/account', ah(async (req, res) => {
  res.json(await payouts.saveAccount(req.userId, accountSchema.parse(req.body)));
}));

router.post('/withdraw', ah(async (req, res) => {
  const { credits } = z.object({ credits: z.number().int() }).parse(req.body);
  res.status(201).json(await payouts.withdraw(req.userId, credits));
}));

export default router;
