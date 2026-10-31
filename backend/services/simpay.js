import crypto from 'node:crypto';
import { query, withTx } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { hmacHex } from '../lib/crypto.js';

/*
  SimPay: a pretend payment gateway and a pretend bank, living in our own database.
  It offers the same small set of calls a real gateway would (create order, fetch payment, register a payee,
  send a payout), so payments.js and payouts.js do not care that the other side is a simulation.
  No real money moves and no outside account is needed.

  Test instruments (shown in the checkout window too):
    card        4111 1111 1111 1111 pays, 5555 5555 5555 4444 pays, 4000 0000 0000 0002 is declined,
                4000 0000 0000 9995 has no funds. Any future expiry, any 3-digit CVV, OTP 123456.
    UPI         any name@bank pays; fail@anything is declined by the payer.
    net banking any bank pays; "Test Bank (always down)" fails.
    payouts     UPI fail@anything, or a bank account number ending 0000, fails after the delay and the credits
                come back. reject@anything is refused instantly.
*/

// Kept so callers can tell "we do not know what happened" (retry with the same key) from a definite "no".
export class GatewayUnknown extends Error {}

const rid = (prefix) => `${prefix}_${crypto.randomBytes(7).toString('hex')}`;
const OTP = '123456';
const GOOD_CARDS = new Set(['4111111111111111', '5555555555554444', '5267318187975449']);
const BANKS = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'DOWN'];
const UPI_RE = /^[\w.\-]{2,256}@[\w.\-]{2,64}$/;

/* ------------------------------- the pretend bank ------------------------------- */

async function ensureBank(client, userId) {
  await client.query(
    `INSERT INTO simpay_bank (user_id, delta_paise, note, ref) VALUES ($1,$2,'Opening balance (simulated)','opening')
     ON CONFLICT (user_id, ref) DO NOTHING`,
    [userId, config.simpay.openingBalancePaise]
  );
}

const bankBalance = async (client, userId) =>
  Number((await client.query('SELECT COALESCE(SUM(delta_paise),0) AS b FROM simpay_bank WHERE user_id=$1', [userId])).rows[0].b);

export async function bankSummary(userId) {
  return withTx(async (c) => {
    await ensureBank(c, userId);
    const balancePaise = await bankBalance(c, userId);
    const { rows } = await c.query(
      `SELECT id, delta_paise, note, created_at FROM simpay_bank WHERE user_id=$1 ORDER BY id DESC LIMIT 30`, [userId]);
    return { balancePaise, entries: rows.map((r) => ({ ...r, delta_paise: Number(r.delta_paise) })) };
  });
}

// Every rupee movement of one user, newest first: card/UPI/net-banking charges and withdrawals.
export async function feed(userId) {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT 'charge' AS kind, id, amount_paise, status, method AS detail, error AS note, created_at, created_at AS updated_at
         FROM simpay_payments WHERE user_id = $1
       UNION ALL
       SELECT 'payout', p.id, p.amount_paise, p.status, a.detail, p.reason, p.created_at, p.updated_at
         FROM simpay_payouts p JOIN simpay_accounts a ON a.id = p.account_id WHERE p.user_id = $1
     ) t ORDER BY created_at DESC LIMIT 30`, [userId]);
  return rows.map((r) => ({
    ...r, amount_paise: Number(r.amount_paise),
    // never hand a full bank account number back to the browser
    detail: r.kind === 'payout' ? maskAccount(r.detail) : r.detail,
  }));
}

function maskAccount(detail) {
  if (detail.includes(':')) { const [ifsc, no] = detail.split(':'); return `${ifsc} ****${no.slice(-4)}`; }
  return detail;
}

/* ------------------------- collecting money (checkout side) ------------------------- */

export async function createOrder({ amountPaise, receipt, notes }) {
  const userId = Number(notes?.userId);
  if (!Number.isInteger(userId)) throw new AppError(400, 'GATEWAY_REJECTED', 'order needs a user');
  const id = rid('order_sim');
  await query('INSERT INTO simpay_orders (id, user_id, amount_paise, receipt) VALUES ($1,$2,$3,$4)', [id, userId, amountPaise, receipt]);
  return { id, amount: amountPaise };
}

export async function fetchPayment(paymentId) {
  const { rows } = await query('SELECT id, order_id, amount_paise, status FROM simpay_payments WHERE id = $1', [paymentId]);
  if (!rows.length) throw new AppError(404, 'GATEWAY_REJECTED', 'No such payment');
  return { id: rows[0].id, order_id: rows[0].order_id, amount: Number(rows[0].amount_paise), status: rows[0].status };
}

// What the browser gets back after a successful checkout: ids plus a signature only this server could make.
export const signPayment = (orderId, paymentId) => hmacHex(config.simpay.secret, `${orderId}|${paymentId}`);

// Returns an error sentence if the payer's details are wrong or declined, otherwise null.
function checkInstrument(method, d) {
  if (method === 'card') {
    const num = String(d.card?.number || '').replace(/\s+/g, '');
    if (!/^\d{16}$/.test(num)) return 'Enter a 16-digit card number';
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(d.card?.expiry || ''));
    if (!m || +m[1] < 1 || +m[1] > 12) return 'Enter the expiry as MM/YY';
    const now = new Date();
    if (2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) return 'This card has expired';
    if (!/^\d{3}$/.test(String(d.card?.cvv || ''))) return 'Enter the 3-digit CVV';
    if (num === '4000000000000002') return 'Card declined by the issuing bank (simulated)';
    if (num === '4000000000009995') return 'Insufficient funds on this card (simulated)';
    if (!GOOD_CARDS.has(num)) return 'Unknown test card. Use 4111 1111 1111 1111';
    if (String(d.otp || '') !== OTP) return 'Wrong OTP. The test OTP is 123456';
    return null;
  }
  if (method === 'upi') {
    const v = String(d.upi || '').trim();
    if (!UPI_RE.test(v)) return 'Enter a valid UPI id like name@bank';
    if (/^fail(@|$)/i.test(v)) return 'The UPI request was declined in the payer app (simulated)';
    return null;
  }
  if (method === 'netbanking') {
    if (!BANKS.includes(d.bank)) return 'Choose a bank';
    if (d.bank === 'DOWN') return 'This bank is not responding (simulated)';
    return null;
  }
  return 'Unknown payment method';
}

const maskInstrument = (method, d) =>
  method === 'card' ? `card ****${String(d.card?.number || '').replace(/\s+/g, '').slice(-4)}`
    : method === 'upi' ? String(d.upi || '').trim() : String(d.bank || '');

/*
  Takes the payment from the payer's pretend bank account. One transaction: the order row is locked, the
  payer is locked, the balance is checked, the debit and the "captured" record are written together.
  A declined attempt is recorded too (the order stays open so the payer can try again).
*/
export async function pay(userId, { orderId, method, ...details }) {
  if (!['card', 'upi', 'netbanking'].includes(method)) throw new AppError(400, 'INVALID_METHOD', 'Choose card, UPI or net banking');
  const out = await withTx(async (c) => {
    const { rows } = await c.query('SELECT * FROM simpay_orders WHERE id = $1 FOR UPDATE', [orderId]);
    const o = rows[0];
    if (!o) throw new AppError(404, 'ORDER_NOT_FOUND');
    if (o.user_id !== userId) throw new AppError(403, 'NOT_YOUR_ORDER');
    if (o.status === 'paid') throw new AppError(409, 'ORDER_ALREADY_PAID', 'This order is already paid');
    await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    await ensureBank(c, userId);

    const amount = Number(o.amount_paise);
    let error = checkInstrument(method, details);
    if (!error && (await bankBalance(c, userId)) < amount) error = 'Not enough money in your SimBank account';
    const paymentId = rid('pay_sim');
    await c.query(
      `INSERT INTO simpay_payments (id, order_id, user_id, amount_paise, method, detail, status, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [paymentId, orderId, userId, amount, method, maskInstrument(method, details), error ? 'failed' : 'captured', error]
    );
    if (!error) {
      await c.query('INSERT INTO simpay_bank (user_id, delta_paise, note, ref) VALUES ($1,$2,$3,$4)',
        [userId, -amount, `Paid UpToSkill (${maskInstrument(method, details)})`, `pay:${paymentId}`]);
      await c.query("UPDATE simpay_orders SET status = 'paid' WHERE id = $1", [orderId]);
    }
    return { paymentId, amount, error };
  });
  if (out.error) throw new AppError(402, 'PAYMENT_DECLINED', out.error);
  return { orderId, paymentId: out.paymentId, amountPaise: out.amount, signature: signPayment(orderId, out.paymentId) };
}

/* -------------------------- paying tutors (payout side) -------------------------- */

export async function createContact({ referenceId }) {
  const m = /^uts-user-(\d+)$/.exec(referenceId || '');
  if (!m) throw new AppError(400, 'GATEWAY_REJECTED', 'bad contact reference');
  return { id: `cont_sim_${m[1]}` };
}

export async function createFundAccount({ contactId, upi, bank }) {
  const m = /^cont_sim_(\d+)$/.exec(contactId || '');
  if (!m) throw new AppError(400, 'GATEWAY_REJECTED', 'Unknown contact');
  const kind = upi ? 'upi' : 'bank';
  const detail = upi ? upi.trim() : `${bank.ifsc}:${bank.accountNumber}`;
  const id = rid('fa_sim');
  await query('INSERT INTO simpay_accounts (id, user_id, kind, detail) VALUES ($1,$2,$3,$4)', [id, Number(m[1]), kind, detail]);
  return { id };
}

// Same idempotency key twice returns the same payout. The pretend bank settles it a few seconds later (settleDue).
export async function createPayout({ fundAccountId, amountPaise, mode, referenceId, idempotencyKey }) {
  const { rows: acct } = await query('SELECT * FROM simpay_accounts WHERE id = $1', [fundAccountId]);
  if (!acct.length) throw new AppError(400, 'GATEWAY_REJECTED', 'Invalid fund account');
  if (/^reject(@|$)/i.test(acct[0].detail)) throw new AppError(400, 'GATEWAY_REJECTED', 'The payee account is blocked (simulated)');
  await query(
    `INSERT INTO simpay_payouts (id, idempotency_key, reference_id, user_id, account_id, amount_paise, mode, settle_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + ($8::int * interval '1 millisecond'))
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [rid('pout_sim'), idempotencyKey, referenceId, acct[0].user_id, fundAccountId, amountPaise, mode, config.simpay.payoutDelayMs]
  );
  const { rows } = await query('SELECT id, status, reference_id FROM simpay_payouts WHERE idempotency_key = $1', [idempotencyKey]);
  return { id: rows[0].id, status: rows[0].status, reference_id: rows[0].reference_id };
}

function payoutFailure(detail) {
  const upiFail = /^fail(@|$)/i.test(detail);
  const bankFail = detail.includes(':') && detail.split(':')[1].endsWith('0000');
  return upiFail || bankFail ? 'The receiving bank declined the transfer (simulated)' : null;
}

// The pretend bank finishing transfers whose time has come. Safe to run from several processes at once.
export async function settleDue() {
  return withTx(async (c) => {
    const { rows } = await c.query(
      `SELECT p.id, p.user_id, p.amount_paise, a.detail
         FROM simpay_payouts p JOIN simpay_accounts a ON a.id = p.account_id
        WHERE p.status = 'processing' AND p.settle_at <= now()
        ORDER BY p.created_at LIMIT 20 FOR UPDATE OF p SKIP LOCKED`);
    for (const p of rows) {
      const why = payoutFailure(p.detail);
      if (why) {
        await c.query("UPDATE simpay_payouts SET status='failed', reason=$2, updated_at=now() WHERE id=$1", [p.id, why]);
      } else {
        await c.query("UPDATE simpay_payouts SET status='processed', updated_at=now() WHERE id=$1", [p.id]);
        await ensureBank(c, p.user_id);
        await c.query('INSERT INTO simpay_bank (user_id, delta_paise, note, ref) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, ref) DO NOTHING',
          [p.user_id, Number(p.amount_paise), `Received from UpToSkill (${maskAccount(p.detail)})`, `payout:${p.id}`]);
      }
    }
    return rows.length;
  });
}

// Finished at the pretend bank but not yet reflected in our own payouts table (e.g. the server restarted in between).
export async function finishedNotApplied() {
  const { rows } = await query(
    `SELECT sp.id, sp.status, sp.reason, p.id AS payout_id
       FROM simpay_payouts sp
       JOIN payouts p ON sp.reference_id = 'uts-payout-' || p.id::text
      WHERE sp.status IN ('processed','failed') AND p.status IN ('queued','processing')
      LIMIT 50`);
  return rows;
}
