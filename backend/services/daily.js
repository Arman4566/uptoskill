import { config } from '../lib/config.js';
import { AppError } from '../lib/errors.js';

const BASE = 'https://api.daily.co/v1';

async function call(method, path, body) {
  if (!config.daily.apiKey) throw new AppError(503, 'VIDEO_NOT_CONFIGURED', 'DAILY_API_KEY is not set');
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${config.daily.apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new AppError(502, 'VIDEO_UNAVAILABLE', err.message);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new AppError(res.status === 404 ? 404 : 502, 'VIDEO_ERROR', json.info || json.error || `Daily ${res.status}`);
    e.dailyStatus = res.status;
    throw e;
  }
  return json;
}

// A private room: nobody can enter without a token that we mint for a participant of that session.
export async function ensureRoom({ name, minutes }) {
  const exp = Math.floor(Date.now() / 1000) + (minutes + 120) * 60; // lesson length + 2h grace
  try {
    await call('POST', '/rooms', {
      name,
      privacy: 'private',
      properties: {
        exp,
        eject_at_room_exp: true,
        max_participants: 2,
        enable_screenshare: true,
        enable_chat: true,
        enable_prejoin_ui: true,
        enable_recording: 'cloud',
      },
    });
  } catch (err) {
    // Same name already exists (second click, or two requests at once): that is fine, use it.
    if (!(err.dailyStatus === 400 && /already exists/i.test(err.message))) throw err;
  }
  return { name, url: `https://${config.daily.domain}.daily.co/${name}` };
}

export async function createToken({ roomName, userId, userName, isOwner, minutes }) {
  const exp = Math.floor(Date.now() / 1000) + (minutes + 120) * 60;
  const props = {
    room_name: roomName,
    user_id: String(userId),
    user_name: userName,
    is_owner: isOwner,
    exp,
    enable_screenshare: true,
  };
  if (isOwner) {
    props.enable_recording = 'cloud';
    // Recording starts by itself the moment the tutor (the room owner) joins. Daily: paid plans only.
    if (config.daily.autoRecord) props.start_cloud_recording = true;
  }
  const { token } = await call('POST', '/meeting-tokens', { properties: props });
  return token;
}

// A short-lived link the browser can play. We never expose recordings publicly.
export async function recordingLink(recordingId, validForSecs = 3600) {
  const out = await call('GET', `/recordings/${encodeURIComponent(recordingId)}/access-link?valid_for_secs=${validForSecs}`);
  return { url: out.download_link, expiresAt: out.expires };
}
