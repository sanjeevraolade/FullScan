import { Router } from 'express';
import * as controller from '../controllers/fe-web-profile.controller.js';

export const feWebProfileRoutes = Router();

// GET /api/v1/fe-web/profile — the signed-in FE's profile + bound mobile device (read-only)
feWebProfileRoutes.get('/', controller.getMyProfile);
