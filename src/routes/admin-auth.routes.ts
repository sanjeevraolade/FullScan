import { Router } from 'express';
import * as controller from '../controllers/admin-auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticateAdmin } from '../middleware/authenticate-admin.js';
import { createLoginRateLimit } from '../middleware/login-rate-limit.js';
import { adminLoginSchema } from './schemas/admin.schema.js';

export const adminAuthRoutes = Router();

// POST /api/v1/admin/auth/login — validate admin credentials, issue session cookie + token
adminAuthRoutes.post('/login', createLoginRateLimit(), validate(adminLoginSchema), controller.login);

// POST /api/v1/admin/auth/logout — clear the session cookie
adminAuthRoutes.post('/logout', authenticateAdmin, controller.logout);

// GET /api/v1/admin/auth/me — current admin's profile
adminAuthRoutes.get('/me', authenticateAdmin, controller.getCurrentAdmin);
