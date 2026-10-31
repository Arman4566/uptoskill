import { AppError } from './errors.js';

// Price comes ONLY from this table. Never from the client or from an LLM.
export const PRICE_TABLE = { 10: 1, 15: 2, 30: 4, 45: 6 };
export const MAX_SESSION_PRICE = 6;

export const ALLOWED_MINUTES = {
  booked: [15, 30, 45],
  instant: [10, 15],
};

export function priceFor(minutes) {
  const p = PRICE_TABLE[minutes];
  if (!p) throw new AppError(400, 'INVALID_MINUTES');
  return Math.min(p, MAX_SESSION_PRICE);
}

export function assertMinutes(type, minutes) {
  if (!ALLOWED_MINUTES[type]?.includes(minutes)) {
    throw new AppError(400, 'INVALID_MINUTES', `minutes must be one of ${ALLOWED_MINUTES[type]}`);
  }
}
