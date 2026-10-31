import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import sessionRoutes from './routes/sessions.js';
import mentorRoutes from './routes/mentors.js';
import slotRoutes from './routes/slots.js';
import paymentRoutes from './routes/payments.js';
import payoutRoutes from './routes/payouts.js';
import simpayRoutes from './routes/simpay.js';
import recordingRoutes from './routes/recordings.js';
import webhookRoutes from './routes/webhooks.js';
import { errorHandler } from './middleware/error.js';

export const app = express();
// CLIENT_ORIGIN may be a comma-separated list (Vite 5173, VS Code Live Server 5500/5501, file:// = "null").
// Empty means "allow any origin", which is fine for local development only.
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
// Keep the exact bytes of each request: webhook signatures are computed over them, not over parsed JSON.
// Lesson notes can carry a few screenshots, so that one route accepts a bigger body (this must come first).
app.use('/sessions/:id/notes', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '200kb', verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/sessions', sessionRoutes);
app.use('/mentors', mentorRoutes);
app.use('/slots', slotRoutes);
app.use('/payments', paymentRoutes);
app.use('/payouts', payoutRoutes);
app.use('/simpay', simpayRoutes);
app.use('/recordings', recordingRoutes);
app.use('/webhooks', webhookRoutes);

app.use(errorHandler);
