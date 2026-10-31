// One-off: tells Daily where to send "recording is ready" events.
// Usage: PUBLIC_URL=https://api.yoursite.com npm run daily:webhook
import 'dotenv/config';
import { config } from '../lib/config.js';

const url = `${process.env.PUBLIC_URL}/webhooks/daily`;
if (!process.env.PUBLIC_URL || !config.daily.apiKey || !config.daily.webhookSecret) {
  console.error('Set PUBLIC_URL, DAILY_API_KEY and DAILY_WEBHOOK_SECRET first.');
  process.exit(1);
}
const res = await fetch('https://api.daily.co/v1/webhooks', {
  method: 'POST',
  headers: { Authorization: `Bearer ${config.daily.apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, eventTypes: ['recording.ready-to-download'], hmac: config.daily.webhookSecret }),
});
console.log(res.status, await res.text());
