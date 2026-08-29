import type { Request, Response, NextFunction } from 'express';
import * as caseService from '../services/case.service.js';

/**
 * GET /api/v1/cases
 * All cases assigned to the current field executive (all buckets).
 */
export function getCases(req: Request, res: Response, next: NextFunction): void {
  try {
    const cases = caseService.getCasesForCurrentFieldExecutive(req.fieldExecutiveId!);
    res.json({ success: true, data: cases });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/cases/:caseId/accept
 * Moves a case from New to Pending/In Progress.
 */
export function acceptCase(req: Request, res: Response, next: NextFunction): void {
  try {
    const { caseId } = req.params;
    const updated = caseService.acceptCase(caseId, req.fieldExecutiveId!);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/:caseId
 * Full Case Details payload for the verification workflow screen.
 */
export function getCaseDetail(req: Request, res: Response, next: NextFunction): void {
  try {
    const { caseId } = req.params;
    const detail = caseService.getCaseDetail(caseId);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/verification-outcome
 * Records the field executive's verification outcome and moves the case to Completed.
 */
export function submitVerificationOutcome(req: Request, res: Response, next: NextFunction): void {
  try {
    const { caseId } = req.params;
    const updated = caseService.submitVerificationOutcome(caseId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
