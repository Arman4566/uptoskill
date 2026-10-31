import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import sessionRoutes from './routes/sessions.js';
import { errorHandler } from './middleware/error.js';

export const app = express();
// CLIENT_ORIGIN may be a comma-separated list (Vite 5173, VS Code Live Server 5500/5501, file:// = "null").
// Empty means "allow any origin", which is fine for local development only.
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '200kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/sessions', sessionRoutes);

app.use(errorHandler);
