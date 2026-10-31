import { withTx, query, pool } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { bus } from '../lib/events.js';
import { config } from '../lib/config.js';
import { creditsToPaise } from '../lib/price.js';
import * as ledger from './ledger.js';
import * as simpay from './simpay.js';

const MAX_ATTEMPTS = 20;
export const refId = (payoutId) => `uts-payout-${payoutId}`;

/* ------------------------------ where to pay ------------------------------ */

// Saves the tutor's UPI id or bank account with the gateway. We keep its ids and a masked label only.
export async function saveAccount(userId, input) {
  const { rows: u } = await query('SELECT name, email, is_platform FROM users WHERE id = $1', [userId]);
  if (!u.length || u[0].is_platform) throw new AppError(404, 'USER_NOT_FOUND');
  const { rows: old } = await query('SELECT gateway_contact_id FROM payout_accounts WHERE user_id = $1', [userId]);

  const contactId = old[0]?.gateway_contact_id
    ?? (await simpay.createContact({ name: u[0].name, email: u[0].email, referenceId: `uts-user-${userId}` })).id;

  const fund = await simpay.createFundAccount(
    input.kind === 'upi' ? { contactId, upi: input.upi } : { contactId, bank: input }
  );
  const label = input.kind === 'upi' ? input.upi : `${input.ifsc} ****${input.accountNumber.slice(-4)}`;
  await query(
    `INSERT INTO payout_accounts (user_id, kind, label, gateway_contact_id, gateway_fund_account_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE SET kind = $2, label = $3, gateway_contact_id = $4,
       gateway_fund_account_id = $5, updated_at = now()`,
    [userId, input.kind, label, contactId, fund.id]
  );
  return { kind: input.kind, label };
}

/* ------------------------------ withdrawing ------------------------------ */

export async function summary(userId) {
  const w = await ledger.getWithdrawable(pool, userId);
  const { rows: acct } = await query('SELECT kind, label FROM payout_accounts WHERE user_id = $1', [userId]);
  const { rows: list } = await query(
    `SELECT id, credits, amount_paise, status, failure_reason, created_at, updated_at
       FROM payouts WHERE user_id = $1 ORDER BY id DESC LIMIT 50`, [userId]
  );
  return {
    ...w,
    minWithdrawCredits: config.minWithdrawCredits,
    maxWithdrawCredits: config.maxWithdrawCredits,
    creditPricePaise: config.creditPricePaise,
    account: acct[0] || null,
    payouts: list,
  };
}

// Takes the credits out of the ledger FIRST (inside one transaction), then asks the gateway to send the money.
// If the ask fails for certain, the credits are put back. If it is uncertain, the retry uses the same key.
export async function withdraw(userId, credits) {
  if (!Number.isInteger(credits) || credits < config.minWithdrawCredits || credits > config.maxWithdrawCredits) {
    throw new AppError(400, 'INVALID_AMOUNT',
      `withdraw between ${config.minWithdrawCredits} and ${config.maxWithdrawCredits} credits`);
  }

  const payout = await withTx(async (c) => {
    await ledger.lockUser(c, userId); // serialises two withdrawals from the same person
    const { rows: acct } = await c.query('SELECT * FROM payout_accounts WHERE user_id = $1', [userId]);
    if (!acct.length) throw new AppError(400, 'NO_PAYOUT_ACCOUNT', 'add a UPI id or bank account first');
    const { withdrawable } = await ledger.getWithdrawable(c, userId);
    if (credits > withdrawable) {
      throw new AppError(402, 'INSUFFICIENT_WITHDRAWABLE', `you can withdraw up to ${withdrawable} credits`);
    }
    const { rows } = await c.query(
      `INSERT INTO payouts (user_id, credits, amount_paise, fund_account_id, mode)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, credits, creditsToPaise(credits), acct[0].gateway_fund_account_id, acct[0].kind === 'upi' ? 'UPI' : 'IMPS']
    );
    await ledger.hold(c, { userId, amount: credits, reason: 'withdraw_hold', refType: 'payout', refId: rows[0].id });
    return rows[0];
  });
  bus.emit('credits:updated', { userId });

  await dispatch(payout.id).catch((err) => console.error('payout dispatch failed (will retry)', payout.id, err.message));
  const { rows } = await query('SELECT * FROM payouts WHERE id = $1', [payout.id]);
  return rows[0];
}

// Sends one queued payout to the gateway. Safe to call any number of times for the same payout.
export async function dispatch(payoutId) {
  const { rows } = await query(
    `UPDATE payouts SET attempts = attempts + 1, updated_at = now()
      WHERE id = $1 AND status = 'queued' RETURNING *`, [payoutId]
  );
  const p = rows[0];
  if (!p) return;
  try {
    const res = await simpay.createPayout({
      fundAccountId: p.fund_account_id, amountPaise: Number(p.amount_paise), mode: p.mode,
      referenceId: refId(p.id), idempotencyKey: refId(p.id),
    });
    await applyStatus({ payoutId: p.id, gatewayPayoutId: res.id, status: res.status, reason: res.status_details?.description });
  } catch (err) {
    if (err instanceof simpay.GatewayUnknown) return; // outcome unknown: stay queued, sweeper retries with the same key
    if (err instanceof AppError && err.code === 'GATEWAY_REJECTED') {
      await applyStatus({ payoutId: p.id, status: 'rejected', reason: err.message });
      return;
    }
    throw err;
  }
}

const FAILED = new Set(['failed', 'rejected', 'cancelled', 'reversed']);
const IN_FLIGHT = new Set(['queued', 'pending', 'initiated', 'processing', 'created']);

// One place that moves a payout between states. Idempotent: the same news may arrive twice or out of order.
export async function applyStatus({ payoutId, gatewayPayoutId, status, reason }) {
  const result = await withTx(async (c) => {
    const { rows } = await c.query('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [payoutId]);
    const p = rows[0];
    if (!p) return null;
    if (gatewayPayoutId && !p.gateway_payout_id) {
      await c.query('UPDATE payouts SET gateway_payout_id = $2 WHERE id = $1', [p.id, gatewayPayoutId]);
    }
    if (FAILED.has(status)) {
      if (p.status === 'failed' || p.status === 'reversed') return null; // already refunded
      const final = status === 'reversed' ? 'reversed' : 'failed';
      await c.query(
        'UPDATE payouts SET status = $2, failure_reason = $3, updated_at = now() WHERE id = $1',
        [p.id, final, reason || status]
      );
      await ledger.credit(c, { userId: p.user_id, amount: p.credits, reason: 'withdraw_refund', refType: 'payout', refId: p.id });
      return { userId: p.user_id };
    }
    if (status === 'processed') {
      if (p.status !== 'paid') await c.query("UPDATE payouts SET status = 'paid', updated_at = now() WHERE id = $1", [p.id]);
    } else if (IN_FLIGHT.has(status) && p.status === 'queued') {
      await c.query("UPDATE payouts SET status = 'processing', updated_at = now() WHERE id = $1", [p.id]);
    }
    return null;
  });
  if (result) bus.emit('credits:updated', { userId: result.userId });
}

// Run every couple of seconds: the pretend bank finishes due transfers, then we apply the result to our own payouts
// (credits stay spent when it was paid, come back once when it failed).
export async function settleSimulated() {
  await simpay.settleDue();
  for (const d of await simpay.finishedNotApplied()) {
    await applyStatus({ payoutId: d.payout_id, gatewayPayoutId: d.id, status: d.status === 'processed' ? 'processed' : 'failed', reason: d.reason });
  }
}

// Run every minute: re-send payouts whose outcome we never learned (network blip, gateway error).
export async function retryQueued() {
  const { rows } = await query(
    `SELECT id FROM payouts
      WHERE status = 'queued' AND updated_at < now() - interval '60 seconds' AND attempts < $1
      ORDER BY id LIMIT 20`, [MAX_ATTEMPTS]
  );
  for (const { id } of rows) await dispatch(id);
  const { rows: stuck } = await query("SELECT id FROM payouts WHERE status = 'queued' AND attempts >= $1", [MAX_ATTEMPTS]);
  if (stuck.length) console.error('PAYOUTS STUCK, needs a human:', stuck.map((r) => r.id).join(','));
  return rows.length;
}
