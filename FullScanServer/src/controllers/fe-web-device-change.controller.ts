import type { Request, Response, NextFunction } from 'express';
import * as deviceChangeService from '../services/device-change.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

function requireFieldExecutiveId(req: Request): string {
  if (!req.fieldExecutiveId) {
    throw new AppError(401, 'Missing field executive web session');
  }
  return req.fieldExecutiveId;
}

/**
 * GET /api/v1/fe-web/device-change
 * Whether the FE can request a device change now, plus their request and device history.
 */
export async function getMyDeviceChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overview = await deviceChangeService.getDeviceChangeOverviewForFieldExecutive(
      requireFieldExecutiveId(req),
    );
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/fe-web/device-change/requests
 * Submits a device change request for the currently bound phone. Answers 201 with
 * the refreshed overview.
 */
export async function createMyDeviceChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fieldExecutiveId = requireFieldExecutiveId(req);
    const { reason } = req.body as { reason?: string };

    const overview = await deviceChangeService.requestDeviceChange(fieldExecutiveId, reason);
    logger.info({ fieldExecutiveId }, 'Device change requested');

    res.status(201).json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
}
