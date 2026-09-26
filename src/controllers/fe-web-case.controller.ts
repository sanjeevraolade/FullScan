import type { Request, Response, NextFunction } from 'express';
import * as feWebCaseService from '../services/fe-web-case.service.js';
import * as feWebEvidenceService from '../services/fe-web-evidence.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * GET /api/v1/fe-web/cases
 * The signed-in field executive's Pending, Beyond TAT and Completed cases.
 */
export async function getMyCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.fieldExecutiveId) {
      throw new AppError(401, 'Missing field executive web session');
    }

    const caseList = await feWebCaseService.getCaseListForFieldExecutive(req.fieldExecutiveId);
    res.json({ success: true, data: caseList });
  } catch (err) {
    next(err);
  }
}

function requireFieldExecutiveId(req: Request): string {
  if (!req.fieldExecutiveId) {
    throw new AppError(401, 'Missing field executive web session');
  }
  return req.fieldExecutiveId;
}

/**
 * GET /api/v1/fe-web/cases/:componentId
 * One of the signed-in field executive's own case components. 404 for anything else.
 */
export async function getMyCaseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await feWebCaseService.getCaseDetailForFieldExecutive(
      requireFieldExecutiveId(req),
      req.params.componentId,
    );
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/fe-web/cases/:componentId/evidence
 * Evidence uploaded for one of the executive's own components, newest first.
 */
export async function getMyCaseEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const evidence = await feWebEvidenceService.getEvidenceForFieldExecutive(
      requireFieldExecutiveId(req),
      req.params.componentId,
    );
    res.json({ success: true, data: evidence });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/fe-web/cases/:componentId/evidence
 * Stores the uploaded images and answers 201 with the component's full evidence list.
 */
export async function uploadMyCaseEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const evidence = await feWebEvidenceService.uploadEvidenceForFieldExecutive(
      requireFieldExecutiveId(req),
      req.params.componentId,
      uploadedFiles.map((file) => ({ originalName: file.originalname, buffer: file.buffer })),
    );
    res.status(201).json({ success: true, data: evidence });
  } catch (err) {
    next(err);
  }
}
