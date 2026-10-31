import { config } from '../lib/config.js';
import { AppError } from '../lib/errors.js';

const BASE = 'https://api.razorpay.com/v1';

// Thrown for network failures and 5xx: we do NOT know whether Razorpay acted, so callers must retry
// with the same idempotency key rather than treat it as a definite failure.
export class RazorpayUnknown extends Error {}

function authHeader() {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Razorpay keys are not set');
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

async function call(method, path, body, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json', ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new RazorpayUnknown(`network error: ${err.message}`);
  }
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
  if (res.status >= 500) throw new RazorpayUnknown(`Razorpay ${res.status}`);
  if (!res.ok) {
    const e = json.error || {};
    throw new AppError(res.status === 401 ? 502 : 400, 'RAZORPAY_REJECTED', e.description || `Razorpay ${res.status}`);
  }
  return json;
}

// ---- Collecting money (Checkout) ----
export const createOrder = ({ amountPaise, receipt, notes }) =>
  call('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes });
export const fetchPayment = (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`);

// ---- Paying tutors (RazorpayX) ----
export const createContact = ({ name, email, referenceId }) =>
  call('POST', '/contacts', { name, email, type: 'vendor', reference_id: referenceId });

export const createFundAccount = ({ contactId, upi, bank }) => {
  if (upi) return call('POST', '/fund_accounts', { contact_id: contactId, account_type: 'vpa', vpa: { address: upi } });
  return call('POST', '/fund_accounts', {
    contact_id: contactId, account_type: 'bank_account',
    bank_account: { name: bank.name, ifsc: bank.ifsc, account_number: bank.accountNumber },
  });
};

// The idempotency key makes retries safe: the same key can never move money twice.
export function createPayout({ fundAccountId, amountPaise, mode, referenceId, idempotencyKey }) {
  const { xAccountNumber } = config.razorpay;
  if (!xAccountNumber) throw new AppError(503, 'PAYOUTS_NOT_CONFIGURED', 'RAZORPAYX_ACCOUNT_NUMBER is not set');
  return call('POST', '/payouts', {
    account_number: xAccountNumber,
    fund_account_id: fundAccountId,
    amount: amountPaise,
    currency: 'INR',
    mode,
    purpose: 'payout',
    queue_if_low_balance: true,
    reference_id: referenceId,
    narration: 'UpToSkill earnings',
  }, { 'X-Payout-Idempotency': idempotencyKey });
}
