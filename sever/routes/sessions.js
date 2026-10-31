import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as sessions from '../services/sessions.js';

const router = Router();
router.use(requireAuth);

const idParam = z.coerce.number().int().positive();

const createSchema = z.object({
  mentorId: z.number().int().positive(),
  minutes: z.number().int(),
  title: z.string().trim().min(3).max(80),
  problemText: z.string().trim().min(10).max(5000),
  tags: z.array(z.string().max(40)).max(6).default([]),
  difficulty: z.number().int().min(1).max(3).optional(),
  slotId: z.number().int().positive().optional(),
});

// Price is deliberately NOT accepted from the client; the server derives it from `minutes`.
router.post('/', ah(async (req, res) => {
  const body = createSchema.parse(req.body);
  const session = await sessions.createRequest({ learnerId: req.userId, ...body });
  res.status(201).json(session);
}));

router.get('/', ah(async (req, res) => {
  res.json(await sessions.listForUser(req.userId));
}));

router.get('/:id', ah(async (req, res) => {
  res.json(await sessions.getForUser(idParam.parse(req.params.id), req.userId));
}));

for (const action of ['accept', 'decline', 'cancel', 'start', 'complete']) {
  router.post(`/:id/${action}`, ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(await sessions[action](id, req.userId));
  }));
}

export default router;
