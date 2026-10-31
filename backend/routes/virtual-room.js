import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

const router = Router();
const ROOM_RE = /^uts-[A-Za-z0-9_-]{8,100}$/;
const cleanName = (value) => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 60);

// Public endpoint: limit tokens per IP so it cannot be used to run up LiveKit usage.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return list.length > 20;
}

// Room links are bearer invites: share them only with the intended participants.
// LiveKit credentials stay on the server and are never sent to the browser.
router.post('/token', async (req, res, next) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests. Wait a minute and try again.' });
    const room = String(req.body?.room || '').trim();
    const name = cleanName(req.body?.name) || 'UpToSkill participant';
    if (!ROOM_RE.test(room)) return res.status(400).json({ error: 'INVALID_ROOM', message: 'Room code is invalid.' });

    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({
        error: 'LIVEKIT_NOT_CONFIGURED',
        message: 'Virtual classroom is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to the backend environment.'
      });
    }

    const identity = `uts-${randomUUID()}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, ttl: '2h' });
    token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    res.set('Cache-Control', 'no-store');
    res.json({ token: await token.toJwt(), serverUrl: LIVEKIT_URL, room, identity, name });
  } catch (err) {
    next(err);
  }
});

export default router;
