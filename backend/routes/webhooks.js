import { Router } from 'express';
import { ah } from '../lib/async.js';
import { config } from '../lib/config.js';
import { AppError } from '../lib/errors.js';
import { verifyDailyWebhook } from '../lib/crypto.js';
import * as video from '../services/video.js';

// No login here: these are called by Daily. The signature is the only thing that proves it.
// app.js keeps the exact request bytes in req.rawBody, because the signature is over those bytes.
const router = Router();

router.post('/daily', ah(async (req, res) => {
  const ok = verifyDailyWebhook(
    req.rawBody, req.get('x-webhook-signature'), req.get('x-webhook-timestamp'), config.daily.webhookSecret
  );
  if (!ok) throw new AppError(400, 'BAD_SIGNATURE');
  const ev = req.body;
  if (ev?.type === 'recording.ready-to-download' && ev.payload?.recording_id) {
    const p = ev.payload;
    await video.saveRecording({
      recordingId: p.recording_id, roomName: p.room_name, durationSec: p.duration, startTs: p.start_ts,
    });
  }
  res.json({ ok: true });
}));

export default router;
