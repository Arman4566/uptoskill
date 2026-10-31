
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

// All money settings live here so there is one place to read and one place to change.
export const config = {
  // 1 credit is worth this many paise. 100 = Rs 1 per credit. Used both for buying and for withdrawing.
  creditPricePaise: num(process.env.CREDIT_PRICE_PAISE, 100),
  // Website fee, as a percent of what the STUDENT pays (tutor sets 95, student sees 100, website keeps 5).
  platformFeePct: num(process.env.PLATFORM_FEE_PCT, 5),
  minPurchaseCredits: num(process.env.MIN_PURCHASE_CREDITS, 50),
  maxPurchaseCredits: num(process.env.MAX_PURCHASE_CREDITS, 50000),
  minWithdrawCredits: num(process.env.MIN_WITHDRAW_CREDITS, 100),
  maxWithdrawCredits: num(process.env.MAX_WITHDRAW_CREDITS, 50000),

  // SimPay: the built-in simulated payment gateway and pretend bank. No real money, no outside accounts needed.
  simpay: {
    keyId: 'simpay_test_key',
    // Signs the "payment done" proof the checkout hands back, exactly like a real gateway's key secret.
    secret: process.env.SIMPAY_SECRET || 'simpay-dev-secret-change-me',
    // How long the pretend bank takes to finish a withdrawal, so the demo shows "on its way" -> "paid".
    payoutDelayMs: num(process.env.SIMPAY_PAYOUT_DELAY_MS, 8000),
    // The gateway's own "payment captured" call-back arrives this long after checkout (covers a closed browser).
    webhookDelayMs: num(process.env.SIMPAY_WEBHOOK_DELAY_MS, 2500),
    // Every user's pretend bank account starts with this many rupees.
    openingBalancePaise: num(process.env.SIMPAY_OPENING_BALANCE_RUPEES, 10000) * 100,
  },

  daily: {
    apiKey: process.env.DAILY_API_KEY || '',
    domain: process.env.DAILY_DOMAIN || '', // e.g. "uptoskill" for uptoskill.daily.co
    webhookSecret: process.env.DAILY_WEBHOOK_SECRET || '', // base64 string, same value you register with Daily
    autoRecord: process.env.DAILY_AUTO_RECORD !== 'false',
  },
};

if (config.platformFeePct < 0 || config.platformFeePct >= 100) {
  throw new Error('PLATFORM_FEE_PCT must be >= 0 and < 100');
}
