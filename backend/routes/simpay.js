import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { config } from '../lib/config.js';
import { requireAuth } from '../middleware/auth.js';
import * as simpay from '../services/simpay.js';
import * as payments from '../services/payments.js';

// The simulated gateway's public face: the checkout window posts here, the wallet reads the pretend bank and the live feed.
const router = Router();
router.use(requireAuth);

router.get('/bank', ah(async (req, res) => res.json(await simpay.bankSummary(req.userId))));
router.get('/feed', ah(async (req, res) => res.json(await simpay.feed(req.userId))));

const payBody = z.object({
  orderId: z.string().min(5).max(64),
  method: z.enum(['card', 'upi', 'netbanking']),
  card: z.object({ number: z.string().max(25), expiry: z.string().max(8), cvv: z.string().max(4) }).optional(),
  upi: z.string().max(100).optional(),
  bank: z.string().max(20).optional(),
  otp: z.string().max(10).optional(),
});

router.post('/pay', ah(async (req, res) => {
  const body = payBody.parse(req.body);
  const out = await simpay.pay(req.userId, body);
  // Like a real gateway, SimPay also tells the shop on its own, a moment later. If the browser closes before
  // calling /payments/verify, this still adds the credits. Both paths are idempotent, so never twice.
  const t = setTimeout(() => {
    payments.handleWebhookPayment({ order_id: out.orderId, id: out.paymentId, status: 'captured', amount: out.amountPaise })
      .catch((err) => console.error('simpay call-back failed', err.message));
  }, config.simpay.webhookDelayMs);
  t.unref?.();
  res.json(out);
}));

export default router;
