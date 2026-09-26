import type { Request, Response, NextFunction } from 'express';
import * as adminCaseService from '../services/admin-case.service.js';
import * as evidenceService from '../services/fe-web-evidence.service.js';
import { logger } from '../utils/logger.js';
import type { CaseBucket } from '../types/case.types.js';
import type { AdminCaseListFilter } from '../types/admin-case.types.js';

const DEFAULT_LIMIT = 25;

/** `validate()` only checks the request — it does not coerce it — so query params are read back here. */
function readListFilter(req: Request): AdminCaseListFilter {
  const { bucket, search, fieldExecutiveId, limit, offset } = req.query;
  const trimmedSearch = typeof search === 'string' ? search.trim() : '';

  return {
    ...(typeof bucket === 'string' ? { bucket: bucket as CaseBucket } : {}),
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
    ...(typeof fieldExecutiveId === 'string' && fieldExecutiveId
      ? { fieldExecutiveId }
      : {}),
    limit: typeof limit === 'string' ? Number(limit) : DEFAULT_LIMIT,
    offset: typeof offset === 'string' ? Number(offset) : 0,
  };
}

/**
 * GET /api/v1/admin/cases
 * Every case component, filtered and paged, with the per-category counts the
 * portal's bucket tabs are labelled from.
 */
export async function listCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await adminCaseService.listCasesForAdmin(readListFilter(req));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/cases/form-options
 * The status/type vocabularies the case editor's selects are built from.
 */
export async function getCaseFormOptions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await adminCaseService.getCaseFormOptions() });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/cases/:caseId
 * One case with every component beneath it. Note `:caseId` here is a **case** id,
 * unlike the mobile `/cases/:caseId` routes where it is a component id.
 */
export async function getCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await adminCaseService.getCaseForAdmin(req.params.caseId);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/cases
 * Creates a case and its components.
 */
export async function createCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await adminCaseService.createCase(req.body);

    logger.info(
      { adminUserId: req.adminUserId, caseId: created.id, caseRef: created.caseRef },
      'Case created from the admin portal',
    );

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/cases/:caseId
 * Updates a case's own fields and upserts the components it carries.
 */
export async function updateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await adminCaseService.updateCase(req.params.caseId, req.body);

    logger.info(
      {
        adminUserId: req.adminUserId,
        caseId: updated.id,
        caseRef: updated.caseRef,
        componentCount: updated.components.length,
      },
      'Case updated from the admin portal',
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/cases/:caseId/evidence
 * Web-uploaded evidence for every component of the case, with who uploaded it.
 */
export async function getCaseEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await evidenceService.getEvidenceForAdminCase(req.params.caseId) });
  } catch (err) {
    next(err);
  }
}
