import { Router } from 'express';
import * as controller from '../controllers/fe-web-auth.controller.js';
import * as meController from '../controllers/field-executive.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticateFeWeb } from '../middleware/authenticate-fe-web.js';
import { createLoginRateLimit } from '../middleware/login-rate-limit.js';
import { feWebLoginSchema } from './schemas/auth.schema.js';

export const feWebAuthRoutes = Router();

// POST /api/v1/fe-web/auth/login — validate FE credentials, issue the web session cookie
feWebAuthRoutes.post('/login', createLoginRateLimit(), validate(feWebLoginSchema), controller.login);

// POST /api/v1/fe-web/auth/logout — clear the session cookie
feWebAuthRoutes.post('/logout', authenticateFeWeb, controller.logout);

// GET /api/v1/fe-web/auth/me — current field executive's profile (same shape as /api/v1/me)
feWebAuthRoutes.get('/me', authenticateFeWeb, meController.getCurrentFieldExecutive);
