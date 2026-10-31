// End-to-end money checks against a real database. Payments and withdrawals go through the real SimPay
// simulator; only Daily (video) is faked. Run: npm run test:money     (needs DATABASE_URL; no keys, no network)
import assert from 'node:assert/strict';
import { pool, withTx } from '../db/pool.js';
import { config } from '../lib/config.js';
import { hmacHex } from '../lib/crypto.js';
import * as ledger from '../services/ledger.js';
import * as sessions from '../services/sessions.js';
import * as payments from '../services/payments.js';
import * as payouts from '../services/payouts.js';
import * as simpay from '../services/simpay.js';
import * as video from '../services/video.js';

config.simpay.payoutDelayMs = 0;     // the pretend bank settles on the next sweep
config.video.provider = 'daily';          // this test covers the Daily path
config.daily.apiKey = 'daily_test';
config.daily.domain = 'uptoskill';

/* ---------------- fake Daily (SimPay is the real simulator) ---------------- */
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ method: opts.method || 'GET', path: u.pathname, body, headers: opts.headers });
  const reply = (status, json) => ({ ok: status < 400, status, text: async () => JSON.stringify(json), json: async () => json });
  if (u.host === 'api.daily.co') {
    if (u.pathname === '/v1/rooms') return reply(200, { name: body.name });
    if (u.pathname === '/v1/meeting-tokens') return reply(200, { token: 'tok_' + body.properties.user_id + (body.properties.is_owner ? '_owner' : '') });
    if (u.pathname.endsWith('/access-link')) return reply(200, { download_link: 'https://dl.example/v.mp4', expires: 123 });
  }
  return reply(404, { error: 'unmocked ' + url });
};

/* ---------------- helpers ---------------- */
const run = Date.now();
const mkUser = (name, level = 1) => withTx(async (c) => (await c.query(
  "INSERT INTO users (name,email,password_hash,level) VALUES ($1,$2,'x',$3) RETURNING id",
  [name, `money_${name}_${run}@test.local`, level])).rows[0].id);
const bal = (id) => ledger.getBalance(pool, id);
const n = async (sql, p) => (await pool.query(sql, p)).rows[0].n;
const expectErr = async (p, code) => assert.rejects(p, (e) => e.code === code, `expected ${code}`);
const CARD = { number: '4111 1111 1111 1111', expiry: '12/39', cvv: '123' };
const bankPaise = async (id) => (await simpay.bankSummary(id)).balancePaise;
// Full happy path through the real code: order -> SimPay checkout pays -> shop verifies the signed proof.
const buyCredits = async (userId, credits) => {
  const o = await payments.createOrder(userId, credits);
  const r = await simpay.pay(userId, { orderId: o.orderId, method: 'card', card: CARD, otp: '123456' });
  await payments.verifyAndCredit(userId, { orderId: r.orderId, paymentId: r.paymentId, signature: r.signature });
  return { o, r };
};
// Runs the pretend bank's settlement sweep until nothing is left to do.
const sweep = async () => { await payouts.settleSimulated(); };

await pool.query("DELETE FROM users WHERE email LIKE 'money\\_%@test.local'");
const platform = await ledger.getPlatformUserId(pool);

/* ---------------- 1. buying credits: money -> credits ---------------- */
const student = await mkUser('student');
{
  await expectErr(payments.createOrder(student, 10), 'INVALID_AMOUNT');           // below minimum
  await expectErr(payments.createOrder(student, 1e9), 'INVALID_AMOUNT');          // above maximum
  const o = await payments.createOrder(student, 200);
  assert.equal(o.amountPaise, 200 * config.creditPricePaise, 'amount comes from the server');
  const bank0 = await bankPaise(student);
  assert.equal(bank0, config.simpay.openingBalancePaise, 'pretend bank starts with the opening balance');

  // the payer's details are checked before any money moves
  await expectErr(simpay.pay(student, { orderId: o.orderId, method: 'card', card: { ...CARD, number: '4000 0000 0000 0002' }, otp: '123456' }), 'PAYMENT_DECLINED');
  await expectErr(simpay.pay(student, { orderId: o.orderId, method: 'card', card: CARD, otp: '000000' }), 'PAYMENT_DECLINED');
  await expectErr(simpay.pay(student, { orderId: o.orderId, method: 'upi', upi: 'fail@simpay' }), 'PAYMENT_DECLINED');
  await expectErr(simpay.pay(student, { orderId: o.orderId, method: 'netbanking', bank: 'DOWN' }), 'PAYMENT_DECLINED');
  await expectErr(simpay.pay(student, { orderId: o.orderId, method: 'bitcoin' }), 'INVALID_METHOD');
  assert.equal(await bankPaise(student), bank0, 'declined attempts take no money');
  assert.equal(await bal(student), 0);
  assert.equal(await n("SELECT COUNT(*)::int n FROM simpay_payments WHERE order_id=$1 AND status='failed'", [o.orderId]), 4, 'failed attempts are recorded');

  // somebody else cannot pay (or verify) this order
  const other = await mkUser('other');
  await expectErr(simpay.pay(other, { orderId: o.orderId, method: 'upi', upi: 'x@bank' }), 'NOT_YOUR_ORDER');

  // a successful payment, retried on the same order: 5 racing checkouts -> money leaves the bank exactly once
  const racers = await Promise.allSettled(Array.from({ length: 5 }, () => simpay.pay(student, { orderId: o.orderId, method: 'upi', upi: 'student@okbank' })));
  assert.equal(racers.filter((r) => r.status === 'fulfilled').length, 1, 'an order can be paid only once');
  const proof = racers.find((r) => r.status === 'fulfilled').value;
  assert.equal(await bankPaise(student), bank0 - o.amountPaise, 'bank debited exactly once');
  assert.equal(await bal(student), 0, 'no credits until the shop verifies');

  // the shop checks the proof. A forged signature, someone else's login, a wrong amount all add nothing.
  await expectErr(payments.verifyAndCredit(student, { orderId: o.orderId, paymentId: proof.paymentId, signature: 'f'.repeat(64) }), 'BAD_SIGNATURE');
  await expectErr(payments.verifyAndCredit(other, { orderId: o.orderId, paymentId: proof.paymentId, signature: proof.signature }), 'NOT_YOUR_ORDER');
  assert.equal(await bal(student), 0, 'bad signature adds nothing');

  // browser verify x5 + the gateway's own call-back x5, all at once -> credited exactly once
  const good = { orderId: o.orderId, paymentId: proof.paymentId, signature: proof.signature };
  await Promise.all([
    ...Array.from({ length: 5 }, () => payments.verifyAndCredit(student, good)),
    ...Array.from({ length: 5 }, () => payments.handleWebhookPayment({ order_id: o.orderId, id: proof.paymentId, status: 'captured', amount: o.amountPaise })),
  ]);
  assert.equal(await bal(student), 200);
  assert.equal(await n("SELECT COUNT(*)::int n FROM credit_ledger WHERE reason='purchase' AND user_id=$1", [student]), 1);
  console.log('1a ok: declines take nothing, racing checkouts pay once, 10 parallel confirmations credit once');

  // closed browser: only the gateway call-back arrives, credits still land
  const o2 = await payments.createOrder(student, 100);
  const p2 = await simpay.pay(student, { orderId: o2.orderId, method: 'netbanking', bank: 'SBI' });
  assert.equal(await bal(student), 200, 'not yet');
  await payments.handleWebhookPayment({ order_id: o2.orderId, id: p2.paymentId, status: 'captured', amount: o2.amountPaise });
  assert.equal(await bal(student), 300, 'the call-back alone is enough');
  // a call-back with the wrong amount, or for an unknown order, adds nothing
  const o3 = await payments.createOrder(student, 100);
  const p3 = await simpay.pay(student, { orderId: o3.orderId, method: 'netbanking', bank: 'SBI' });
  await payments.handleWebhookPayment({ order_id: o3.orderId, id: p3.paymentId, status: 'captured', amount: 1 });
  await payments.handleWebhookPayment({ order_id: 'order_sim_nope', id: 'pay_sim_nope', status: 'captured', amount: 100 });
  assert.equal(await bal(student), 300, 'wrong-amount / unknown-order call-backs add nothing');
  // a payment id that belongs to a different order must be refused
  await expectErr(payments.verifyAndCredit(student, { orderId: o3.orderId, paymentId: p2.paymentId, signature: simpay.signPayment(o3.orderId, p2.paymentId) }), 'PAYMENT_ORDER_MISMATCH');
  await payments.verifyAndCredit(student, { orderId: o3.orderId, paymentId: p3.paymentId, signature: p3.signature });
  assert.equal(await bal(student), 400);
  console.log('1b ok: call-back alone credits; wrong-amount, unknown and cross-order proofs add nothing');

  // not enough money in the pretend bank -> declined, nothing moves
  const poor = await mkUser('poor');
  await withTx((c) => c.query("INSERT INTO simpay_bank (user_id, delta_paise, note, ref) VALUES ($1,$2,'drained','test')", [poor, -config.simpay.openingBalancePaise + 50 * config.creditPricePaise]));
  const o4 = await payments.createOrder(poor, 100);
  await expectErr(simpay.pay(poor, { orderId: o4.orderId, method: 'upi', upi: 'poor@bank' }), 'PAYMENT_DECLINED');
  assert.equal(await bal(poor), 0);
  console.log('1c ok: an empty bank account cannot pay');
}

/* ---------------- 2. the 5% fee when a lesson completes ---------------- */
const tutor = await mkUser('tutor', 2);
{
  const before = await bal(platform);
  const s = await sessions.createRequest({ learnerId: student, mentorId: tutor, minutes: 15, title: 'Fee test', problemText: 'fee test problem text' });
  assert.deepEqual([s.credits, s.tutor_credits, s.fee_credits], [100, 95, 5], 'tutor 95 -> student sees 100');
  await sessions.accept(s.id, tutor);
  assert.equal(await bal(student), 300, '400 - 100 held');
  await sessions.start(s.id, tutor);
  await Promise.all(Array.from({ length: 10 }, () => sessions.complete(s.id, tutor)));
  assert.equal(await bal(tutor), 95, 'tutor gets exactly 95');
  assert.equal(await bal(platform) - before, 5, 'website keeps exactly 5');
  assert.equal(await bal(student), 300);
  const net = await n("SELECT COALESCE(SUM(delta),0)::int n FROM credit_ledger WHERE ref_type='session' AND ref_id=$1", [s.id]);
  assert.equal(net, 0, 'hold + payout + fee nets to zero: no credit created or lost');
  console.log('2 ok: 100 held -> tutor 95 + website 5, nothing created or lost');
}

/* ---------------- 3. withdrawing: credits -> money ---------------- */
const earner = await mkUser('earner', 3);
{
  await buyCredits(earner, 300); // bought credits: spendable, not withdrawable
  await withTx((c) => ledger.credit(c, { userId: earner, amount: 400, reason: 'payout', refType: 'session', refId: 900001 }));
  await withTx((c) => ledger.credit(c, { userId: earner, amount: 50, reason: 'bonus', refType: 'session', refId: 900001 }));
  const w = await ledger.getWithdrawable(pool, earner);
  assert.equal(w.balance, 750);
  assert.equal(w.withdrawable, 400, 'only teaching earnings can be cashed out');

  await expectErr(payouts.withdraw(earner, 150), 'NO_PAYOUT_ACCOUNT');
  const acct = await payouts.saveAccount(earner, { kind: 'upi', upi: 'earner@okbank' });
  assert.equal(acct.label, 'earner@okbank');
  await expectErr(payouts.withdraw(earner, 50), 'INVALID_AMOUNT');          // below minimum
  await expectErr(payouts.withdraw(earner, 401), 'INSUFFICIENT_WITHDRAWABLE');
  assert.equal(await bal(earner), 750, 'refused withdrawals touch nothing');

  // two withdrawals of 250 at once with only 400 withdrawable -> exactly one wins
  const bankBefore = await bankPaise(earner);
  const race = await Promise.allSettled([payouts.withdraw(earner, 250), payouts.withdraw(earner, 250)]);
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1, 'no double withdrawal');
  assert.equal(await bal(earner), 500);
  assert.equal((await ledger.getWithdrawable(pool, earner)).withdrawable, 150);
  const p1 = race.find((r) => r.status === 'fulfilled').value;
  assert.equal(p1.status, 'processing', 'on its way');
  assert.equal(Number(p1.amount_paise), 250 * config.creditPricePaise);
  assert.equal(await bankPaise(earner), bankBefore, 'money has not arrived yet');

  // the pretend bank finishes the transfer; the sweep applies it. Running the sweep again changes nothing.
  await sweep(); await sweep(); await sweep();
  assert.equal((await pool.query('SELECT status FROM payouts WHERE id=$1', [p1.id])).rows[0].status, 'paid');
  assert.equal(await bankPaise(earner), bankBefore + 250 * config.creditPricePaise, 'money arrived exactly once');
  assert.equal(await bal(earner), 500, 'credits stay spent');
  console.log('3a ok: bought/bonus credits not withdrawable; racing withdrawals cannot overdraw; money arrives once');

  // a reversal after "paid" (rare) refunds once even if it is reported 8 times at once
  await Promise.all(Array.from({ length: 8 }, () => payouts.applyStatus({ payoutId: p1.id, status: 'reversed', reason: 'bank reversed' })));
  assert.equal(await bal(earner), 750, 'credits come back exactly once');
  assert.equal(await n("SELECT COUNT(*)::int n FROM credit_ledger WHERE reason='withdraw_refund' AND ref_id=$1", [p1.id]), 1);
  assert.equal((await ledger.getWithdrawable(pool, earner)).withdrawable, 400);
  console.log('3b ok: replayed reversal refunds exactly once');

  // the receiving bank declines -> credits come back after the delay, no money arrives
  await payouts.saveAccount(earner, { kind: 'upi', upi: 'fail@okbank' });
  const bank2 = await bankPaise(earner);
  const p2 = await payouts.withdraw(earner, 120);
  assert.equal(p2.status, 'processing');
  assert.equal(await bal(earner), 630, 'held while in flight');
  await sweep();
  const r2 = (await pool.query('SELECT status, failure_reason FROM payouts WHERE id=$1', [p2.id])).rows[0];
  assert.equal(r2.status, 'failed');
  assert.ok(r2.failure_reason);
  assert.equal(await bal(earner), 750, 'declined payout is refunded');
  assert.equal(await bankPaise(earner), bank2, 'no money arrived');

  // the gateway refuses outright -> refunded straight away
  await payouts.saveAccount(earner, { kind: 'upi', upi: 'reject@okbank' });
  const p3 = await payouts.withdraw(earner, 130);
  assert.equal(p3.status, 'failed');
  assert.equal(await bal(earner), 750, 'rejected payout is refunded at once');

  // unknown outcome: our payout stays queued, retry reuses the SAME key, so SimPay creates one payout only
  await payouts.saveAccount(earner, { kind: 'upi', upi: 'earner@okbank' });
  const real = simpay.createPayout; // pretend the first call never got an answer, although SimPay did act
  const p4 = await (async () => {
    const orig = config.simpay.payoutDelayMs;
    const fa = (await pool.query('SELECT gateway_fund_account_id f FROM payout_accounts WHERE user_id=$1', [earner])).rows[0].f;
    const row = (await pool.query("INSERT INTO payouts (user_id, credits, amount_paise, fund_account_id, mode) VALUES ($1,140,$2,$3,'UPI') RETURNING *",
      [earner, 140 * config.creditPricePaise, fa])).rows[0];
    await withTx((c) => ledger.hold(c, { userId: earner, amount: 140, reason: 'withdraw_hold', refType: 'payout', refId: row.id }));
    await real({ fundAccountId: fa, amountPaise: Number(row.amount_paise), mode: 'UPI', referenceId: `uts-payout-${row.id}`, idempotencyKey: `uts-payout-${row.id}` });
    config.simpay.payoutDelayMs = orig;
    return row;
  })();
  assert.equal((await pool.query('SELECT status FROM payouts WHERE id=$1', [p4.id])).rows[0].status, 'queued');
  await pool.query("UPDATE payouts SET updated_at = now() - interval '5 minutes' WHERE id = $1", [p4.id]);
  await payouts.retryQueued();
  assert.equal(await n("SELECT COUNT(*)::int n FROM simpay_payouts WHERE idempotency_key=$1", [`uts-payout-${p4.id}`]), 1, 'same key, one payout');
  await sweep();
  assert.equal((await pool.query('SELECT status FROM payouts WHERE id=$1', [p4.id])).rows[0].status, 'paid');
  assert.equal(await bal(earner), 610);
  console.log('3c ok: declined payout refunded after the delay; rejected one refunded at once; retry reuses the same key');

  // the website account can never log in or withdraw
  await expectErr(payouts.saveAccount(platform, { kind: 'upi', upi: 'p@bank' }), 'USER_NOT_FOUND');
}

/* ---------------- 4. video lessons + recordings ---------------- */
{
  const s = await sessions.createRequest({ learnerId: student, mentorId: tutor, minutes: 15, title: 'Video test', problemText: 'video test problem text' });
  await expectErr(video.joinInfo(s.id, tutor), 'LESSON_NOT_OPEN');        // not accepted yet
  await sessions.accept(s.id, tutor);
  const outsider = await mkUser('outsider');
  await expectErr(video.joinInfo(s.id, outsider), 'NOT_PARTICIPANT');

  const [t, st] = await Promise.all([video.joinInfo(s.id, tutor), video.joinInfo(s.id, student)]);
  assert.equal(t.role, 'tutor'); assert.equal(st.role, 'student');
  assert.equal(t.roomUrl, `https://uptoskill.daily.co/uts-s${s.id}`);
  assert.equal(t.roomUrl, st.roomUrl, 'both join the same room');
  const tokenReq = calls.filter((c) => c.path === '/v1/meeting-tokens').map((c) => c.body.properties);
  const tp = tokenReq.find((p) => p.is_owner), sp = tokenReq.find((p) => !p.is_owner);
  assert.equal(tp.start_cloud_recording, true, 'recording starts when the tutor joins');
  assert.equal(sp.start_cloud_recording, undefined, 'student token cannot record');
  assert.ok(tp.enable_screenshare && sp.enable_screenshare, 'both can share a screen');
  assert.equal((await pool.query('SELECT status FROM sessions WHERE id=$1', [s.id])).rows[0].status, 'in_progress', 'tutor joining starts the lesson');

  // Daily says the recording is ready (twice: webhooks repeat)
  assert.equal(await video.saveRecording({ recordingId: 'rec_1', roomName: `uts-s${s.id}`, durationSec: 900, startTs: 1730350000 }), true);
  await video.saveRecording({ recordingId: 'rec_1', roomName: `uts-s${s.id}`, durationSec: 900, startTs: 1730350000 });
  assert.equal(await video.saveRecording({ recordingId: 'rec_x', roomName: 'someone-elses-room', durationSec: 1 }), false);
  const recs = await video.listRecordings(s.id, student);
  assert.equal(recs.length, 1);
  await expectErr(video.listRecordings(s.id, outsider), 'NOT_PARTICIPANT');
  const link = await video.playLink(recs[0].id, student);
  assert.equal(link.url, 'https://dl.example/v.mp4');
  await expectErr(video.playLink(recs[0].id, outsider), 'NOT_PARTICIPANT');
  console.log('4 ok: private room, tutor-only recording, one recording row per webhook, only the two participants can watch');
}

console.log('\nAll money tests passed');
await pool.query("DELETE FROM users WHERE email LIKE 'money\\_%@test.local'");
await pool.end();
