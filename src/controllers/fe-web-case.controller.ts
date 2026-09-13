import type { Request, Response, NextFunction } from 'express';
import * as feWebCaseService from '../services/fe-web-case.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * GET /api/v1/fe-web/cases
 * The signed-in field executive's Pending, Beyond TAT and Completed cases.
 */
export function getMyCases(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.fieldExecutiveId) {
      throw new AppError(401, 'Missing field executive web session');
    }

    const caseList = feWebCaseService.getCaseListForFieldExecutive(req.fieldExecutiveId);
    res.json({ success: true, data: caseList });
  } catch (err) {
    next(err);
  }
}
