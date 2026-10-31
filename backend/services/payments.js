import { withTx, query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { bus } from '../lib/events.js';
import { config } from '../lib/config.js';
import { creditsToPaise } from '../lib/price.js';
import { verifyCheckoutSignature } from '../lib/crypto.js';
import * as ledger from './ledger.js';
import * as simpay from './simpay.js';

export function publicConfig() {
  return {
    mode: 'simulated',
    keyId: config.simpay.keyId,
    creditPricePaise: config.creditPricePaise,
    minPurchaseCredits: config.minPurchaseCredits,
    maxPurchaseCredits: config.maxPurchaseCredits,
    platformFeePct: config.platformFeePct,
  };
}

// Step 1: the server decides the amount (never the browser) and creates the SimPay order.
export async function createOrder(userId, credits) {
  if (!Number.isInteger(credits) || credits < config.minPurchaseCredits || credits > config.maxPurchaseCredits) {
    throw new AppError(400, 'INVALID_AMOUNT',
      `buy between ${config.minPurchaseCredits} and ${config.maxPurchaseCredits} credits`);
  }
  const amountPaise = creditsToPaise(credits);
  const order = await simpay.createOrder({
    amountPaise, receipt: `u${userId}-${Date.now()}`, notes: { userId: String(userId), credits: String(credits) },
  });
  const { rows } = await query(
    `INSERT INTO payments (user_id, credits, amount_paise, gateway_order_id)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [userId, credits, amountPaise, order.id]
  );
  return { paymentId: rows[0].id, orderId: order.id, amountPaise, currency: 'INR', credits };
}

// Adds the credits exactly once, however many times it is called (browser verify AND webhook both call this).
async function fulfil(orderId, gatewayPaymentId) {
  const result = await withTx(async (c) => {
    const { rows } = await c.query('SELECT * FROM payments WHERE gateway_order_id = $1 FOR UPDATE', [orderId]);
    const p = rows[0];
    if (!p) throw new AppError(404, 'ORDER_NOT_FOUND');
    if (p.status === 'paid') return { payment: p, credited: false };
    await c.query(
      `UPDATE payments SET status = 'paid', gateway_payment_id = $2, paid_at = now() WHERE id = $1`,
      [p.id, gatewayPaymentId]
    );
    const credited = await ledger.credit(c, {
      userId: p.user_id, amount: p.credits, reason: 'purchase', refType: 'payment', refId: p.id,
    });
    return { payment: p, credited };
  });
  if (result.credited) bus.emit('credits:updated', { userId: result.payment.user_id });
  return result;
}

// Checks with the gateway itself that the money really arrived, for the right order and the right amount.
async function confirmCaptured(orderId, paymentId) {
  const pay = await simpay.fetchPayment(paymentId);
  if (pay.order_id !== orderId) throw new AppError(400, 'PAYMENT_ORDER_MISMATCH');
  const { rows } = await query('SELECT amount_paise FROM payments WHERE gateway_order_id = $1', [orderId]);
  if (!rows.length) throw new AppError(404, 'ORDER_NOT_FOUND');
  if (Number(pay.amount) !== Number(rows[0].amount_paise)) throw new AppError(400, 'PAYMENT_AMOUNT_MISMATCH');
  return pay.status === 'captured';
}

// Step 2: the browser reports success. We do not trust it until the signature AND the gateway's own record agree.
export async function verifyAndCredit(userId, { orderId, paymentId, signature }) {
  const { rows } = await query('SELECT user_id FROM payments WHERE gateway_order_id = $1', [orderId]);
  if (!rows.length) throw new AppError(404, 'ORDER_NOT_FOUND');
  if (rows[0].user_id !== userId) throw new AppError(403, 'NOT_YOUR_ORDER');
  if (!verifyCheckoutSignature({ orderId, paymentId, signature, keySecret: config.simpay.secret })) {
    throw new AppError(400, 'BAD_SIGNATURE');
  }
  if (!(await confirmCaptured(orderId, paymentId))) {
    // Authorised but not captured yet. The gateway call-back will finish it when it captures.
    return { status: 'pending' };
  }
  const { payment } = await fulfil(orderId, paymentId);
  return { status: 'paid', credits: payment.credits };
}

// Step 2b: the gateway tells us directly (covers a browser that closed before calling verify).
export async function handleWebhookPayment(entity) {
  if (!entity?.order_id || entity.status !== 'captured') return;
  const { rows } = await query('SELECT amount_paise FROM payments WHERE gateway_order_id = $1', [entity.order_id]);
  if (!rows.length) return; // not one of ours
  if (Number(entity.amount) !== Number(rows[0].amount_paise)) {
    console.error('payment amount mismatch', entity.order_id);
    return;
  }
  await fulfil(entity.order_id, entity.id);
}

export async function markFailed(entity) {
  if (!entity?.order_id) return;
  await query(
    `UPDATE payments SET status = 'failed' WHERE gateway_order_id = $1 AND status = 'created'`,
    [entity.order_id]
  );
}

export async function listForUser(userId) {
  const { rows } = await query(
    `SELECT id, credits, amount_paise, status, created_at, paid_at
       FROM payments WHERE user_id = $1 ORDER BY id DESC LIMIT 50`, [userId]
  );
  return rows;
}
