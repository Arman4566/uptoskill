// Run by hand:  npm run events:now          -> make this week's events now (if missing) and send today's reminders now
//               npm run events:now -- --no-reminders
import 'dotenv/config';
import { ensureWeekly } from '../services/events.js';
import { runDailyReminders } from '../services/reminders.js';
import { pool } from '../db/pool.js';

console.log('events:', await ensureWeekly());
if (!process.argv.includes('--no-reminders')) console.log('reminders:', await runDailyReminders({ force: true }));
await pool.end();
