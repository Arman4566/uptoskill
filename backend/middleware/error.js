import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'VALIDATION', details: err.issues });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  // express.json() failures: malformed JSON or oversized body are client errors, not server errors.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'TOO_LARGE' });
  console.error(err);
  res.status(500).json({ error: 'INTERNAL' });
}
