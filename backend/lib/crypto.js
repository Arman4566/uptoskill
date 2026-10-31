import crypto from 'node:crypto';

// Constant-time string compare (different lengths are simply "not equal").
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

// SimPay Checkout: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret), hex.
export function verifyCheckoutSignature({ orderId, paymentId, signature, keySecret }) {
  if (!keySecret || !signature) return false;
  return safeEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

// Daily webhooks: base64( HMAC_SHA256(base64decode(secret), `${timestamp}.${raw body}`) ) in X-Webhook-Signature.
export function verifyDailyWebhook(rawBody, signature, timestamp, secretB64) {
  if (!secretB64 || !signature || !timestamp || !rawBody) return false;
  const expected = crypto.createHmac('sha256', Buffer.from(secretB64, 'base64'))
    .update(`${timestamp}.${rawBody.toString('utf8')}`).digest('base64');
  return safeEqual(expected, signature);
}
