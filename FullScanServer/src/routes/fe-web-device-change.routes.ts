import { Router } from 'express';
import * as controller from '../controllers/fe-web-device-change.controller.js';
import { validate } from '../middleware/validate.js';
import { createDeviceChangeRequestSchema } from './schemas/device-change.schema.js';

/** Mounted behind `authenticateFeWeb` — see app.ts. */
export const feWebDeviceChangeRoutes = Router();

// GET /api/v1/fe-web/device-change — eligibility + request and device history
feWebDeviceChangeRoutes.get('/', controller.getMyDeviceChange);

// POST /api/v1/fe-web/device-change/requests — request a device change
feWebDeviceChangeRoutes.post(
  '/requests',
  validate(createDeviceChangeRequestSchema),
  controller.createMyDeviceChangeRequest,
);
