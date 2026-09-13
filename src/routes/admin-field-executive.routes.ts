import { Router } from 'express';
import * as controller from '../controllers/admin-field-executive.controller.js';
import { validate } from '../middleware/validate.js';
import {
  getFieldExecutiveHistorySchema,
  listAdminFieldExecutivesSchema,
} from './schemas/admin-case.schema.js';

/** Mounted behind `authenticateAdmin` — see app.ts. */
export const adminFieldExecutiveRoutes = Router();

// GET /api/v1/admin/field-executives — roster with assignment and detection counts
adminFieldExecutiveRoutes.get(
  '/',
  validate(listAdminFieldExecutivesSchema),
  controller.listFieldExecutives,
);

// GET /api/v1/admin/field-executives/:fieldExecutiveId/history — case-wise history
adminFieldExecutiveRoutes.get(
  '/:fieldExecutiveId/history',
  validate(getFieldExecutiveHistorySchema),
  controller.getFieldExecutiveHistory,
);
