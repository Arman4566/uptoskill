import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { config } from '../lib/config.js';
import * as sessions from './sessions.js';
import * as daily from './daily.js';

async function loadForParticipant(sessionId, userId) {
  const s = await sessions.getForUser(sessionId, userId); // 404 / 403 for strangers
  return s;
}

// Gives a participant everything the browser needs to join the lesson.
// The tutor is the room owner (can record and screen-share); the student joins as a guest who can also share.
export async function joinInfo(sessionId, userId) {
  let s = await loadForParticipant(sessionId, userId);
  if (!['accepted', 'in_progress'].includes(s.status)) {
    throw new AppError(409, 'LESSON_NOT_OPEN', `lesson is ${s.status}; it opens once the tutor accepts`);
  }
  const isTutor = userId === s.mentor_id;
  const name = `uts-s${s.id}`;
  const room = await daily.ensureRoom({ name, minutes: s.minutes });
  if (s.video_room !== name) await query('UPDATE sessions SET video_room = $2 WHERE id = $1', [s.id, name]);

  // The tutor joining starts the lesson (the clock for the session), exactly once.
  if (isTutor && s.status === 'accepted') {
    s = await sessions.start(s.id, userId).catch((err) => {
      if (err.code === 'INVALID_TRANSITION') return s; // already started by the other side
      throw err;
    });
  }
  const { rows } = await query('SELECT name FROM users WHERE id = $1', [userId]);
  const token = await daily.createToken({
    roomName: name, userId, userName: rows[0].name, isOwner: isTutor, minutes: s.minutes,
  });
  return {
    role: isTutor ? 'tutor' : 'student',
    roomUrl: room.url,
    token,
    recording: config.daily.autoRecord, // both people are told the lesson is recorded
    session: { id: s.id, title: s.title, minutes: s.minutes, status: s.status, problemText: s.problem_text },
  };
}

// Called by the Daily webhook when a recording has finished processing.
export async function saveRecording({ recordingId, roomName, durationSec, startTs }) {
  const { rows } = await query('SELECT id FROM sessions WHERE video_room = $1', [roomName]);
  if (!rows.length) return false; // not one of ours
  await query(
    `INSERT INTO recordings (session_id, daily_recording_id, duration_sec, started_at)
     VALUES ($1,$2,$3, to_timestamp($4))
     ON CONFLICT (daily_recording_id) DO NOTHING`,
    [rows[0].id, recordingId, durationSec ?? null, startTs ?? null]
  );
  return true;
}

export async function listRecordings(sessionId, userId) {
  await loadForParticipant(sessionId, userId);
  const { rows } = await query(
    `SELECT id, duration_sec, started_at, created_at FROM recordings WHERE session_id = $1 ORDER BY started_at, id`,
    [sessionId]
  );
  return rows;
}

// Only the tutor or the student of the lesson may watch it.
export async function playLink(recordingId, userId) {
  const { rows } = await query(
    `SELECT r.daily_recording_id, s.learner_id, s.mentor_id
       FROM recordings r JOIN sessions s ON s.id = r.session_id WHERE r.id = $1`, [recordingId]
  );
  if (!rows.length) throw new AppError(404, 'RECORDING_NOT_FOUND');
  if (userId !== rows[0].learner_id && userId !== rows[0].mentor_id) throw new AppError(403, 'NOT_PARTICIPANT');
  return daily.recordingLink(rows[0].daily_recording_id);
}
