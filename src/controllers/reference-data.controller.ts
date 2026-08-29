import type { Request, Response, NextFunction } from 'express';
import * as referenceDataService from '../services/reference-data.service.js';

/**
 * GET /api/v1/reference-data
 * Bulk dropdown/option data (statuses, UTV/Insufficient reasons, photo
 * types) fetched once after login.
 */
export function getReferenceData(req: Request, res: Response, next: NextFunction): void {
  try {
    const data = referenceDataService.getReferenceData();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
