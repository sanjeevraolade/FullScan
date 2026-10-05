import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from './schemas/auth.schema.js';

export const authRoutes = Router();

// POST /api/v1/auth/login — validates username + password, returns a session token, the field executive's
// profile and the master-data version (masterDataUpdatedAt)
authRoutes.post('/login', validate(loginSchema), controller.login);

// POST /api/v1/auth/logout — revokes the bearer's mobile session (no body); device binding is unchanged
authRoutes.post('/logout', authenticate, controller.logout);
