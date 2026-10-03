import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from './schemas/auth.schema.js';

export const authRoutes = Router();

// POST /api/v1/auth/login — validates username + password, returns a session token and the field executive's profile
authRoutes.post('/login', validate(loginSchema), controller.login);
