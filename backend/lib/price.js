import { AppError } from './errors.js';
import { config } from './config.js';

// What the TUTOR earns for a session of each length, in credits. Never from the client or from an LLM.
// These are chosen so the student-facing price is a round number: 95 -> 100, 190 -> 200, 285 -> 300.
export const TUTOR_PRICE_TABLE = { 10: 57, 15: 95, 30: 190, 45: 285 };

export const ALLOWED_MINUTES = {
  booked: [15, 30, 45],
  instant: [10, 15],
};

/*
  Fee model: the website adds its cut ON TOP of the tutor's price, so the tutor always receives exactly
  the amount they set. With a 5% fee the student pays tutor / 0.95, rounded UP to a whole credit:
    tutor 95 -> student 100 (tutor gets 95, website keeps 5)
  Integer maths only (no floating point on money).
*/
export function studentPriceFor(tutorCredits, feePct = config.platformFeePct) {
  const keep = 100 - feePct;
  return Math.floor((tutorCredits * 100 + keep - 1) / keep);
}

// Returns { tutorCredits, studentCredits, feeCredits } for a session length.
export function quoteFor(minutes, feePct = config.platformFeePct) {
  const tutorCredits = TUTOR_PRICE_TABLE[minutes];
  if (!tutorCredits) throw new AppError(400, 'INVALID_MINUTES');
  const studentCredits = studentPriceFor(tutorCredits, feePct);
  return { tutorCredits, studentCredits, feeCredits: studentCredits - tutorCredits };
}

// Kept for older callers: the amount the student is charged.
export const priceFor = (minutes) => quoteFor(minutes).studentCredits;

export function assertMinutes(type, minutes) {
  if (!ALLOWED_MINUTES[type]?.includes(minutes)) {
    throw new AppError(400, 'INVALID_MINUTES', `minutes must be one of ${ALLOWED_MINUTES[type]}`);
  }
}

export const creditsToPaise = (credits) => credits * config.creditPricePaise;
