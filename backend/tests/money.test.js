// No database and no network needed:  npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { studentPriceFor, quoteFor, TUTOR_PRICE_TABLE } from '../lib/price.js';
import {
  safeEqual, hmacHex, verifyCheckoutSignature, verifyDailyWebhook,
} from '../lib/crypto.js';

test('the 95 -> 100 example: tutor sets 95, student pays 100, website keeps 5', () => {
  assert.equal(studentPriceFor(95, 5), 100);
  const q = quoteFor(15, 5);
  assert.deepEqual(q, { tutorCredits: 95, studentCredits: 100, feeCredits: 5 });
});

test('every lesson length gives a round student price', () => {
  const prices = Object.fromEntries(Object.keys(TUTOR_PRICE_TABLE).map((m) => [m, quoteFor(Number(m), 5).studentCredits]));
  assert.deepEqual(prices, { 10: 60, 15: 100, 30: 200, 45: 300 });
});

test('fee maths holds for every price: split adds up, tutor keeps what they set, site never gets under 5%', () => {
  for (let tutor = 1; tutor <= 5000; tutor++) {
    const student = studentPriceFor(tutor, 5);
    const fee = student - tutor;
    assert.ok(fee >= 0 && tutor + fee === student);
    assert.ok(tutor * 100 <= student * 95, `site must keep >= 5% at tutor=${tutor}`);
    assert.ok(student === tutor || (student - 1) * 95 < tutor * 100, `student price must be the smallest that works at tutor=${tutor}`);
  }
});

test('0% fee changes nothing; other percentages work', () => {
  assert.equal(studentPriceFor(95, 0), 95);
  assert.equal(studentPriceFor(90, 10), 100);
});

test('unknown lesson length is refused', () => {
  assert.throws(() => quoteFor(20), (e) => e.code === 'INVALID_MINUTES');
});

test('safeEqual', () => {
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', 'abcd'));
});

test('SimPay checkout signature: valid, tampered order, tampered payment, wrong secret, missing', () => {
  const secret = 'keysecret';
  const sig = hmacHex(secret, 'order_1|pay_1');
  assert.ok(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, keySecret: secret }));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_2', paymentId: 'pay_1', signature: sig, keySecret: secret }));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig, keySecret: secret }));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, keySecret: 'other' }));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: '', keySecret: secret }));
  assert.ok(!verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, keySecret: '' }));
});

test('Daily webhook signature: base64 secret, timestamp.body, base64 digest', () => {
  const secretB64 = Buffer.from('daily-secret-bytes').toString('base64');
  const body = Buffer.from('{"type":"recording.ready-to-download","payload":{"recording_id":"r1"}}');
  const ts = '1730350000';
  const sig = crypto.createHmac('sha256', Buffer.from(secretB64, 'base64')).update(`${ts}.${body}`).digest('base64');
  assert.ok(verifyDailyWebhook(body, sig, ts, secretB64));
  assert.ok(!verifyDailyWebhook(body, sig, '1730350001', secretB64), 'timestamp is part of the signature');
  assert.ok(!verifyDailyWebhook(Buffer.from('{}'), sig, ts, secretB64));
  assert.ok(!verifyDailyWebhook(body, sig, ts, ''));
  // using the base64 text itself as the key (a common mistake) must NOT verify
  const wrong = crypto.createHmac('sha256', secretB64).update(`${ts}.${body}`).digest('base64');
  assert.ok(!verifyDailyWebhook(body, wrong, ts, secretB64));
});
