import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

/**
 * Caps password guessing against a browser sign-in endpoint: 10 failed attempts per
 * IP per 15 minutes. Only failures count (`skipSuccessfulRequests`).
 *
 * A factory, not a shared instance: each call gets its own in-memory store, so
 * exhausting the admin login window never locks field executives out, or vice versa.
 */
export function createLoginRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      success: false,
      error: 'Too many sign-in attempts. Please try again in a few minutes.',
    },
  });
}
