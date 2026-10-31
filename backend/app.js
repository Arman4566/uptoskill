import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import sessionRoutes from './routes/sessions.js';
import mentorRoutes from './routes/mentors.js';
import slotRoutes from './routes/slots.js';
import stateRoutes from './routes/state.js';
import { query } from './db/pool.js';
import { corsOrigin } from './lib/cors.js';
import virtualRoomRoutes from './routes/virtual-room.js';
import { errorHandler } from './middleware/error.js';

export const app = express();
app.use(cors({ origin: corsOrigin }));
// The saved app data (profile photo, session history) can be bigger than a normal API call.
app.use('/state', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '200kb' }));

app.get('/health', async (req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, db: true }); }
  catch { res.status(503).json({ ok: false, db: false }); }
});
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/sessions', sessionRoutes);
app.use('/mentors', mentorRoutes);
app.use('/slots', slotRoutes);
app.use('/state', stateRoutes);
app.use('/virtual-room', virtualRoomRoutes);

app.use(errorHandler);
