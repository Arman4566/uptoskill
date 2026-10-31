import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as video from '../services/video.js';

const router = Router();
router.use(requireAuth);

// Returns a temporary playback link (about an hour) for a lesson recording. Only that lesson's two people.
router.get('/:id/play', ah(async (req, res) => {
  res.json(await video.playLink(z.coerce.number().int().positive().parse(req.params.id), req.userId));
}));

export default router;
