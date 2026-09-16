import { Router } from 'express';
import * as controller from '../controllers/admin-case.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createAdminCaseSchema,
  getAdminCaseSchema,
  listAdminCasesSchema,
  updateAdminCaseSchema,
} from './schemas/admin-case.schema.js';

/** Mounted behind `authenticateAdmin` — see app.ts. */
export const adminCaseRoutes = Router();

// GET /api/v1/admin/cases — every case component, filtered/paged, plus category counts
adminCaseRoutes.get('/', validate(listAdminCasesSchema), controller.listCases);

// POST /api/v1/admin/cases — create a case and its components
adminCaseRoutes.post('/', validate(createAdminCaseSchema), controller.createCase);

// GET /api/v1/admin/cases/form-options — status vocabularies for the editor's selects.
// Registered before /:caseId so the literal path is not swallowed by the param route.
adminCaseRoutes.get('/form-options', controller.getCaseFormOptions);

// GET /api/v1/admin/cases/:caseId — one case with all its components (case id, not component id)
adminCaseRoutes.get('/:caseId', validate(getAdminCaseSchema), controller.getCase);

// GET /api/v1/admin/cases/:caseId/evidence — web-uploaded evidence across the case's components (read-only)
adminCaseRoutes.get('/:caseId/evidence', validate(getAdminCaseSchema), controller.getCaseEvidence);

// PUT /api/v1/admin/cases/:caseId — update case fields and upsert its components
adminCaseRoutes.put('/:caseId', validate(updateAdminCaseSchema), controller.updateCase);
