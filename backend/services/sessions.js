import { pool, withTx, query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { bus } from '../lib/events.js';
import { quoteFor, assertMinutes } from '../lib/price.js';
import * as ledger from './ledger.js';

const REQUEST_TTL_MIN = Number(process.env.REQUEST_TTL_MIN || 30);
const ACCEPTED_TTL_MIN = Number(process.env.ACCEPTED_TTL_MIN || 60);

// Counts the finished session and promotes the mentor (levels never go down). Without this every
// user stays at level 1 forever and "mentor must be above learner" blocks all bookings.
// Level 2: 3 sessions given. Level 3: 10 and rating >= 4.0. Level 4: 25 and rating >= 4.5.
// Mentors with no ratings yet are not held back by the rating rule.
const LEVEL_UP_SQL = `
  UPDATE users SET
    sessions_given = sessions_given + 1,
    level = GREATEST(level, CASE
      WHEN sessions_given + 1 >= 25 AND (rating_count = 0 OR rating_avg >= 4.5) THEN 4
      WHEN sessions_given + 1 >= 10 AND (rating_count = 0 OR rating_avg >= 4.0) THEN 3
      WHEN sessions_given + 1 >= 3 THEN 2
      ELSE 1 END)
  WHERE id = $1`;

/*
  State machine (every transition locks the row, checks status, then acts):
    requested -> accepted (HOLD) -> in_progress -> completed (PAYOUT)
    requested -> declined | cancelled | expired          (nothing held)
    accepted  -> cancelled | expired                      (RELEASE)
*/

async function lockSession(c, id) {
  const { rows } = await c.query('SELECT * FROM sessions WHERE id = $1 FOR UPDATE', [id]);
  if (!rows.length) throw new AppError(404, 'SESSION_NOT_FOUND');
  return rows[0];
}

function assertParticipant(s, userId) {
  if (userId !== s.learner_id && userId !== s.mentor_id) throw new AppError(403, 'NOT_PARTICIPANT');
}

function badTransition(s, to) {
  return new AppError(409, 'INVALID_TRANSITION', `cannot go from ${s.status} to ${to}`);
}

// Call only AFTER the transaction has committed.
function publish(session, creditUserIds = []) {
  bus.emit('session:status', { sessionId: session.id, status: session.status, session });
  for (const userId of new Set(creditUserIds)) bus.emit('credits:updated', { userId });
}

async function releaseHold(c, s) {
  const held = await ledger.getHeldAmount(c, 'session', s.id);
  if (held > 0) {
    await ledger.credit(c, {
      userId: s.learner_id, amount: held, reason: 'release', refType: 'session', refId: s.id,
    });
  }
  if (s.slot_id) await c.query('UPDATE availability_slots SET is_booked = false WHERE id = $1', [s.slot_id]);
  return held > 0;
}

export async function createRequest({
  learnerId, mentorId, minutes, title, problemText, tags = [], difficulty = null, slotId = null,
}) {
  if (learnerId === mentorId) throw new AppError(400, 'SELF_SESSION');
  assertMinutes('booked', minutes);
  const { tutorCredits, studentCredits: credits, feeCredits } = quoteFor(minutes);

  const session = await withTx(async (c) => {
    const { rows: users } = await c.query('SELECT id, level FROM users WHERE id = ANY($1)', [[learnerId, mentorId]]);
    const learner = users.find((u) => u.id === learnerId);
    const mentor = users.find((u) => u.id === mentorId);
    if (!learner || !mentor) throw new AppError(404, 'USER_NOT_FOUND');
    if (mentor.level <= learner.level) throw new AppError(403, 'MENTOR_LEVEL_TOO_LOW');

    if (tags.length) {
      const { rows } = await c.query('SELECT name FROM skills WHERE name = ANY($1)', [tags]);
      if (rows.length !== new Set(tags).size) throw new AppError(400, 'UNKNOWN_TAG');
    }
    if (slotId) {
      const { rows } = await c.query(
        'SELECT id FROM availability_slots WHERE id = $1 AND user_id = $2 AND is_booked = false AND starts_at > now()',
        [slotId, mentorId]
      );
      if (!rows.length) throw new AppError(400, 'BAD_SLOT');
    }
    const { rows } = await c.query(
      `INSERT INTO sessions (learner_id, mentor_id, type, status, title, problem_text, tags,
                             difficulty, minutes, credits, tutor_credits, fee_credits, slot_id, expires_at)
       VALUES ($1,$2,'booked','requested',$3,$4,$5,$6,$7,$8,$9,$10,$11, now() + make_interval(mins => $12::int))
       RETURNING *`,
      [learnerId, mentorId, title, problemText, tags, difficulty, minutes, credits, tutorCredits, feeCredits,
        slotId, REQUEST_TTL_MIN]
    );
    return rows[0];
  });

  publish(session);
  return session;
}

export async function accept(sessionId, mentorId) {
  const session = await withTx(async (c) => {
    const s = await lockSession(c, sessionId);
    if (s.mentor_id !== mentorId) throw new AppError(403, 'NOT_YOUR_SESSION');
    if (s.status !== 'requested') throw badTransition(s, 'accepted');
    if (s.expires_at && new Date(s.expires_at) < new Date()) throw new AppError(409, 'REQUEST_EXPIRED');

    // Escrow: lock learner, check balance, write negative row.
    await ledger.hold(c, { userId: s.learner_id, amount: s.credits, refType: 'session', refId: s.id });

    if (s.slot_id) {
      const { rowCount } = await c.query(
        'UPDATE availability_slots SET is_booked = true WHERE id = $1 AND is_booked = false', [s.slot_id]
      );
      if (rowCount === 0) throw new AppError(409, 'SLOT_TAKEN');
    }
    const { rows } = await c.query(
      "UPDATE sessions SET status = 'accepted', accepted_at = now() WHERE id = $1 RETURNING *", [s.id]
    );
    return rows[0];
  });
  publish(session, [session.learner_id]);
  return session;
}

export async function decline(sessionId, mentorId) {
  const session = await withTx(async (c) => {
    const s = await lockSession(c, sessionId);
    if (s.mentor_id !== mentorId) throw new AppError(403, 'NOT_YOUR_SESSION');
    if (s.status !== 'requested') throw badTransition(s, 'declined');
    const { rows } = await c.query(
      "UPDATE sessions SET status = 'declined', ended_at = now() WHERE id = $1 RETURNING *", [s.id]
    );
    return rows[0];
  });
  publish(session);
  return session;
}

export async function cancel(sessionId, userId) {
  const { session, released } = await withTx(async (c) => {
    const s = await lockSession(c, sessionId);
    assertParticipant(s, userId);
    if (!['requested', 'accepted'].includes(s.status)) throw badTransition(s, 'cancelled');
    const released = s.status === 'accepted' ? await releaseHold(c, s) : false;
    const { rows } = await c.query(
      "UPDATE sessions SET status = 'cancelled', ended_at = now() WHERE id = $1 RETURNING *", [s.id]
    );
    return { session: rows[0], released };
  });
  publish(session, released ? [session.learner_id] : []);
  return session;
}

export async function start(sessionId, userId) {
  const session = await withTx(async (c) => {
    const s = await lockSession(c, sessionId);
    assertParticipant(s, userId);
    if (s.status !== 'accepted') throw badTransition(s, 'in_progress');
    const { rows } = await c.query(
      "UPDATE sessions SET status = 'in_progress', started_at = now() WHERE id = $1 RETURNING *", [s.id]
    );
    return rows[0];
  });
  publish(session);
  return session;
}

// Mentor confirms completion. Idempotent: calling it again returns the settled session untouched.
export async function complete(sessionId, mentorId) {
  const { session, changed } = await withTx(async (c) => {
    const s = await lockSession(c, sessionId);
    if (s.mentor_id !== mentorId) throw new AppError(403, 'NOT_YOUR_SESSION');
    if (s.status === 'completed') return { session: s, changed: false };
    if (s.status !== 'in_progress') throw badTransition(s, 'completed');
    if (s.settled_at) throw new AppError(409, 'ALREADY_SETTLED');

    const held = await ledger.getHeldAmount(c, 'session', s.id);
    if (held <= 0) throw new AppError(500, 'NO_HOLD_FOUND');

    // Split the escrow: the tutor gets exactly the price they set, the website keeps the rest (the 5%).
    // Sessions created before the fee existed have no tutor_credits and pay out in full.
    const tutorShare = s.tutor_credits ?? held;
    const fee = held - tutorShare;
    if (tutorShare <= 0 || fee < 0) throw new AppError(500, 'BAD_PRICE_SPLIT');
    await ledger.credit(c, {
      userId: s.mentor_id, amount: tutorShare, reason: 'payout', refType: 'session', refId: s.id,
    });
    if (fee > 0) {
      await ledger.credit(c, {
        userId: await ledger.getPlatformUserId(c), amount: fee, reason: 'fee', refType: 'session', refId: s.id,
      });
    }
    const { rows } = await c.query(
      "UPDATE sessions SET status = 'completed', ended_at = now(), settled_at = now() WHERE id = $1 RETURNING *",
      [s.id]
    );
    await c.query(LEVEL_UP_SQL, [s.mentor_id]);
    return { session: rows[0], changed: true };
  });
  if (changed) publish(session, [session.mentor_id, session.learner_id]);
  return session;
}

export async function getForUser(sessionId, userId) {
  const { rows } = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  if (!rows.length) throw new AppError(404, 'SESSION_NOT_FOUND');
  assertParticipant(rows[0], userId);
  return rows[0];
}

export async function listForUser(userId) {
  const { rows } = await query(
    'SELECT * FROM sessions WHERE learner_id = $1 OR mentor_id = $1 ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows;
}

// Sweeper: expire stale requests (nothing held) and accepted-but-never-started sessions (release).
const staleCond = (p) => `(
  (status = 'requested' AND expires_at < now())
  OR (status = 'accepted' AND accepted_at < now() - make_interval(mins => $${p}::int))
)`;

export async function expireStale() {
  const { rows } = await pool.query(`SELECT id FROM sessions WHERE ${staleCond(1)}`, [ACCEPTED_TTL_MIN]);
  let count = 0;
  for (const { id } of rows) {
    const out = await withTx(async (c) => {
      const { rows: locked } = await c.query(
        `SELECT * FROM sessions WHERE id = $1 AND ${staleCond(2)} FOR UPDATE`, [id, ACCEPTED_TTL_MIN]
      );
      if (!locked.length) return null; // someone moved it on since we looked
      const s = locked[0];
      const released = s.status === 'accepted' ? await releaseHold(c, s) : false;
      const { rows: upd } = await c.query(
        "UPDATE sessions SET status = 'expired', ended_at = now() WHERE id = $1 RETURNING *", [s.id]
      );
      return { session: upd[0], released };
    });
    if (out) {
      publish(out.session, out.released ? [out.session.learner_id] : []);
      count++;
    }
  }
  return count;
}
