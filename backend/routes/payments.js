import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as payments from '../services/payments.js';

const router = Router();
router.use(requireAuth);

router.get('/config', (req, res) => res.json(payments.publicConfig()));
router.get('/', ah(async (req, res) => res.json(await payments.listForUser(req.userId))));

// Body carries credits only. The rupee amount is worked out on the server.
router.post('/orders', ah(async (req, res) => {
  const { credits } = z.object({ credits: z.number().int() }).parse(req.body);
  res.status(201).json(await payments.createOrder(req.userId, credits));
}));

router.post('/verify', ah(async (req, res) => {
  const body = z.object({
    orderId: z.string().min(5).max(64),
    paymentId: z.string().min(5).max(64),
    signature: z.string().min(10).max(200),
  }).parse(req.body);
  res.json(await payments.verifyAndCredit(req.userId, body));
}));

export default router;
