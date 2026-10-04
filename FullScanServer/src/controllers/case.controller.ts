import type { Request, Response, NextFunction } from 'express';
import * as caseService from '../services/case.service.js';
import { caseListQuerySchema } from '../routes/schemas/case.schema.js';
import { AppError } from '../utils/app-error.js';

/** `authenticate` sets it on every request it lets through; this only guards the type. */
function currentFieldExecutiveId(req: Request): string {
  if (!req.fieldExecutiveId) {
    throw new AppError(401, 'Missing authentication token');
  }
  return req.fieldExecutiveId;
}

/**
 * GET /api/v1/cases?type=<new|pending|beyond_tat|completed>[&cursor=…]
 * One page of one tab: `{ type, items, nextCursor, pageSize }`.
 *
 * Without `type`: the **deprecated** all-buckets array (items carry `caseId` and
 * `bucket`), kept unchanged for app builds already in the field. Remove that branch
 * once no supported build calls it — see docs/api-contracts/cases-by-tab.md.
 */
export async function getCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fieldExecutiveId = currentFieldExecutiveId(req);
    // `validate()` has already checked the query; parsing it again just types it.
    const { type, cursor } = caseListQuerySchema.parse(req.query);

    const data =
      type === undefined
        ? await caseService.getCasesForCurrentFieldExecutive(fieldExecutiveId)
        : await caseService.getCasesPage(fieldExecutiveId, type, cursor);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/counts
 * The four tab counts: `{ new, pending, beyond_tat, completed }`.
 */
export async function getCaseCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const counts = await caseService.getCaseCounts(currentFieldExecutiveId(req));
    res.json({ success: true, data: counts });
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
    const updated = await caseService.acceptCase(caseId, currentFieldExecutiveId(req));
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
