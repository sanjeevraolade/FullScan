import { Router } from 'express';
import * as controller from '../controllers/security.controller.js';
import { validate } from '../middleware/validate.js';
import { reportMockLocationSchema } from './schemas/security.schema.js';

export const securityRoutes = Router();

// POST /api/v1/security/mock-location — the app reports a faked device location
securityRoutes.post(
  '/mock-location',
  validate(reportMockLocationSchema),
  controller.reportMockLocation,
);
