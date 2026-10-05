import { Router } from 'express';
import * as controller from '../controllers/case.controller.js';
import { validate } from '../middleware/validate.js';
import { parseMobileEvidenceJson } from '../middleware/json-body.js';
import {
  acceptCaseSchema,
  getCaseCountsSchema,
  getCaseDetailSchema,
  listCasesSchema,
  submitVerificationOutcomeSchema,
  uploadCaseEvidenceSchema,
  uploadCaseEvidenceTargetSchema,
} from './schemas/case.schema.js';

export const caseRoutes = Router();

// GET /api/v1/cases?type=<tab>[&cursor=…] — one page of one tab.
// Without `type` it still returns the DEPRECATED all-buckets array, for app builds already in the field.
caseRoutes.get('/', validate(listCasesSchema), controller.getCases);

// GET /api/v1/cases/counts — the four tab counts.
// Must stay above GET /:caseId, or 'counts' is matched as a case id.
caseRoutes.get('/counts', validate(getCaseCountsSchema), controller.getCaseCounts);

// PATCH /api/v1/cases/:caseId/accept — New -> Pending/In Progress
caseRoutes.patch('/:caseId/accept', validate(acceptCaseSchema), controller.acceptCase);

// GET /api/v1/cases/:caseId — full Case Details payload
caseRoutes.get('/:caseId', validate(getCaseDetailSchema), controller.getCaseDetail);

// POST /api/v1/cases/:caseId/verification-outcome — records the verification outcome, moves the case to Completed
caseRoutes.post(
  '/:caseId/verification-outcome',
  validate(submitVerificationOutcomeSchema),
  controller.submitVerificationOutcome,
);

// POST /api/v1/cases/:caseId/evidence — one camera photo, base64 in a JSON body, with its
// capture metadata. 201 new / 200 same bytes already recorded.
// The app-wide 100 kb JSON parser skips this route (middleware/json-body.ts); it parses its
// own body, up to 14 MB, here — after authentication — and validates it after that.
caseRoutes.post(
  '/:caseId/evidence',
  validate(uploadCaseEvidenceTargetSchema),
  parseMobileEvidenceJson,
  validate(uploadCaseEvidenceSchema),
  controller.uploadCaseEvidence,
);
