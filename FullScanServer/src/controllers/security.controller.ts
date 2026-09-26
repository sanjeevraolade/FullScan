import type { Request, Response, NextFunction } from 'express';
import * as mockLocationService from '../services/mock-location.service.js';
import type { MockLocationReportInput } from '../types/mock-location.types.js';

/**
 * POST /api/v1/security/mock-location
 * Records a mocked/faked device location detected by the mobile app.
 *
 * Answers 200 for a re-delivered report and 201 for a newly recorded one, so
 * the app can tell an accepted retry from a first delivery.
 */
export async function reportMockLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await mockLocationService.reportMockLocationEvent(
      req.fieldExecutiveId!,
      req.body as MockLocationReportInput,
    );
    res.status(result.isDuplicate ? 200 : 201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
