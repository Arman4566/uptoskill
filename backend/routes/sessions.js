import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as sessions from '../services/sessions.js';
import * as video from '../services/video.js';
import * as notes from '../services/notes.js';

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

// Join the video lesson (creates the private room on first use) and list its recordings.
router.post('/:id/video-token', ah(async (req, res) => {
  res.json(await video.joinInfo(idParam.parse(req.params.id), req.userId));
}));
router.get('/:id/recordings', ah(async (req, res) => {
  res.json(await video.listRecordings(idParam.parse(req.params.id), req.userId));
}));

// Tutor's lesson notes. Saved as the tutor types; turned into a PDF for both people when the lesson ends.
const notesSchema = z.object({ body: z.string().max(30000), images: z.array(z.string()).max(notes.MAX_IMAGES).default([]) });
router.get('/:id/notes', ah(async (req, res) => {
  res.json(await notes.getForTutor(idParam.parse(req.params.id), req.userId));
}));
router.put('/:id/notes', ah(async (req, res) => {
  res.json(await notes.save(idParam.parse(req.params.id), req.userId, notesSchema.parse(req.body)));
}));
router.get('/:id/notes.pdf', ah(async (req, res) => {
  const pdf = await notes.getPdf(idParam.parse(req.params.id), req.userId);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="lesson-${req.params.id}-notes.pdf"`, 'Cache-Control': 'private, no-store' });
  res.send(pdf);
}));

for (const action of ['accept', 'decline', 'cancel', 'start', 'complete']) {
  router.post(`/:id/${action}`, ah(async (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(await sessions[action](id, req.userId));
  }));
}

export default router;
