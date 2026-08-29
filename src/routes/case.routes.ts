import { Router } from 'express';
import * as controller from '../controllers/case.controller.js';
import { validate } from '../middleware/validate.js';
import { acceptCaseSchema, getCaseDetailSchema, submitVerificationOutcomeSchema } from './schemas/case.schema.js';

export const caseRoutes = Router();

// GET /api/v1/cases — all cases assigned to the current field executive
caseRoutes.get('/', controller.getCases);

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
