import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/admin-auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticateAdmin } from '../middleware/authenticate-admin.js';
import { adminLoginSchema } from './schemas/admin.schema.js';

export const adminAuthRoutes = Router();

/** Caps password guessing against the admin portal: 10 attempts per IP per 15 minutes. */
const adminLoginRateLimit = rateLimit({
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

// POST /api/v1/admin/auth/login — validate admin credentials, issue session cookie + token
adminAuthRoutes.post('/login', adminLoginRateLimit, validate(adminLoginSchema), controller.login);

// POST /api/v1/admin/auth/logout — clear the session cookie
adminAuthRoutes.post('/logout', authenticateAdmin, controller.logout);

// GET /api/v1/admin/auth/me — current admin's profile
adminAuthRoutes.get('/me', authenticateAdmin, controller.getCurrentAdmin);
