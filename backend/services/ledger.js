import { AppError } from '../lib/errors.js';

const BONUS_DAILY_CAP = Number(process.env.BONUS_DAILY_CAP || 3);

// All functions take a transaction client so the caller controls atomicity.

export async function getBalance(client, userId) {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(delta), 0)::int AS balance FROM credit_ledger WHERE user_id = $1',
    [userId]
  );
  return rows[0].balance;
}

export async function lockUser(client, userId) {
  const { rows } = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (!rows.length) throw new AppError(404, 'USER_NOT_FOUND');
}

// Returns true if a row was written, false if the unique index said "already done".
async function insertRow(client, { userId, delta, reason, refType, refId }) {
  const { rowCount } = await client.query(
    `INSERT INTO credit_ledger (user_id, delta, reason, ref_type, ref_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ref_type, ref_id, reason, user_id) DO NOTHING`,
    [userId, delta, reason, refType, refId]
  );
  return rowCount === 1;
}

// Lock user -> check balance -> insert negative row. Safe against double spend.
export async function hold(client, { userId, amount, refType, refId, reason = 'hold' }) {
  await lockUser(client, userId);
  const balance = await getBalance(client, userId);
  if (balance < amount) {
    throw new AppError(402, 'INSUFFICIENT_CREDITS', `need ${amount}, have ${balance}`);
  }
  const inserted = await insertRow(client, { userId, delta: -amount, reason, refType, refId });
  if (!inserted) throw new AppError(409, 'ALREADY_HELD');
}

// Positive movement: starter, release, payout, bonus, bounty_payout, bounty_refund.
// Idempotent: returns false (and writes nothing) if this exact row already exists.
export async function credit(client, { userId, amount, reason, refType, refId }) {
  return insertRow(client, { userId, delta: amount, reason, refType, refId });
}

// How many credits are currently held for a thing (session or bounty).
export async function getHeldAmount(client, refType, refId, reason = 'hold') {
  const { rows } = await client.query(
    `SELECT COALESCE(-SUM(delta), 0)::int AS held
       FROM credit_ledger WHERE ref_type = $1 AND ref_id = $2 AND reason = $3`,
    [refType, refId, reason]
  );
  return rows[0].held;
}

// +1 bonus per 5-star session, capped per mentor per day. Returns true if granted.
export async function grantBonus(client, { mentorId, sessionId }) {
  await lockUser(client, mentorId); // serialises the cap check per mentor
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM credit_ledger
      WHERE user_id = $1 AND reason = 'bonus' AND created_at >= date_trunc('day', now())`,
    [mentorId]
  );
  if (rows[0].n >= BONUS_DAILY_CAP) return false;
  return credit(client, { userId: mentorId, amount: 1, reason: 'bonus', refType: 'session', refId: sessionId });
}

// ---- Real-money helpers ----------------------------------------------------------------------------

export async function getPlatformUserId(client) {
  const { rows } = await client.query('SELECT id FROM users WHERE is_platform = true LIMIT 1');
  if (!rows.length) throw new AppError(500, 'NO_PLATFORM_USER', 'run npm run db:migrate');
  return rows[0].id;
}

/*
  How many credits a user may withdraw as real money.
  Only credits EARNED by teaching (session payouts, bounty payouts) can be cashed out. Credits that were
  bought, given as starter credit or given as a bonus can be spent on lessons but never withdrawn, so the
  website cannot be used to turn free credits (or a refund-free purchase) into cash.
    withdrawable = min(balance, earned_by_teaching - already_withdrawn)
  Call it inside a transaction after lockUser() when you are about to act on the number.
*/
export async function getWithdrawable(client, userId) {
  const { rows } = await client.query(
    `SELECT
       COALESCE(SUM(delta), 0)::int AS balance,
       COALESCE(SUM(delta) FILTER (WHERE reason IN ('payout','bounty_payout')), 0)::int AS earned,
       COALESCE(-SUM(delta) FILTER (WHERE reason IN ('withdraw_hold','withdraw_refund')), 0)::int AS withdrawn
     FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );
  const { balance, earned, withdrawn } = rows[0];
  return { balance, earned, withdrawn, withdrawable: Math.max(0, Math.min(balance, earned - withdrawn)) };
}
