import { Router } from 'express';
import * as controller from '../controllers/admin-device-change.controller.js';
import { validate } from '../middleware/validate.js';
import {
  decideDeviceChangeRequestSchema,
  listDeviceChangeRequestsSchema,
} from './schemas/device-change.schema.js';

/** Mounted behind `authenticateAdmin` (both admin roles) — see app.ts. */
export const adminDeviceChangeRoutes = Router();

// GET /api/v1/admin/device-change-requests — list with per-status counts
adminDeviceChangeRoutes.get('/', validate(listDeviceChangeRequestsSchema), controller.listDeviceChangeRequests);

// POST /api/v1/admin/device-change-requests/:requestId/approve — approve, release the device binding
adminDeviceChangeRoutes.post(
  '/:requestId/approve',
  validate(decideDeviceChangeRequestSchema),
  controller.approveDeviceChangeRequest,
);

// POST /api/v1/admin/device-change-requests/:requestId/reject — reject, binding unchanged
adminDeviceChangeRoutes.post(
  '/:requestId/reject',
  validate(decideDeviceChangeRequestSchema),
  controller.rejectDeviceChangeRequest,
);
