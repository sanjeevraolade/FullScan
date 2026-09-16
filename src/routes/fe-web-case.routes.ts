import { Router } from 'express';
import * as controller from '../controllers/fe-web-case.controller.js';
import { validate } from '../middleware/validate.js';
import { parseEvidenceUpload } from '../middleware/evidence-upload.js';
import { feWebCaseDetailSchema, feWebEvidenceSchema } from './schemas/fe-web-case.schema.js';

export const feWebCaseRoutes = Router();

// GET /api/v1/fe-web/cases — the signed-in FE's Pending, Beyond TAT and Completed cases (read-only)
feWebCaseRoutes.get('/', controller.getMyCases);

// GET /api/v1/fe-web/cases/:componentId — one of the FE's own components, read-only
feWebCaseRoutes.get('/:componentId', validate(feWebCaseDetailSchema), controller.getMyCaseDetail);

// GET /api/v1/fe-web/cases/:componentId/evidence — evidence uploaded for that component
feWebCaseRoutes.get('/:componentId/evidence', validate(feWebEvidenceSchema), controller.getMyCaseEvidence);

// POST /api/v1/fe-web/cases/:componentId/evidence — multipart image upload (web exception to camera-only)
feWebCaseRoutes.post(
  '/:componentId/evidence',
  validate(feWebEvidenceSchema),
  parseEvidenceUpload,
  controller.uploadMyCaseEvidence,
);
