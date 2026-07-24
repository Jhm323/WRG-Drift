import { HttpError } from '../lib/http-error.js';

const SUBMISSION_INTERVAL_MS = 3000;
const lastSubmissionAtByUser = new Map();

// Blocks scripted run-submission spam (build plan §7). In-memory is fine at
// this scale (<100 users, single API instance) — no need for a shared store.
export function rateLimitScoreSubmission(req, res, next) {
  const userId = req.user.id;
  const now = Date.now();
  const lastAt = lastSubmissionAtByUser.get(userId);

  if (lastAt && now - lastAt < SUBMISSION_INTERVAL_MS) {
    throw new HttpError(429, 'Submitting scores too quickly — wait a moment and try again');
  }

  lastSubmissionAtByUser.set(userId, now);
  next();
}
