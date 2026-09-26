import type { Request, Response, NextFunction } from 'express';
import * as caseService from '../services/case.service.js';

/**
 * GET /api/v1/cases
 * All cases assigned to the current field executive (all buckets).
 */
export async function getCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cases = await caseService.getCasesForCurrentFieldExecutive(req.fieldExecutiveId!);
    res.json({ success: true, data: cases });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/cases/:caseId/accept
 * Moves a case from New to Pending/In Progress.
 */
export async function acceptCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { caseId } = req.params;
    const updated = await caseService.acceptCase(caseId, req.fieldExecutiveId!);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/:caseId
 * Full Case Details payload for the verification workflow screen.
 */
export async function getCaseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { caseId } = req.params;
    const detail = await caseService.getCaseDetail(caseId);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/verification-outcome
 * Records the field executive's verification outcome and moves the case to Completed.
 */
export async function submitVerificationOutcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { caseId } = req.params;
    const updated = await caseService.submitVerificationOutcome(caseId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
