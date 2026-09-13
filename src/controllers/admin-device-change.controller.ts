import type { Request, Response, NextFunction } from 'express';
import * as deviceChangeService from '../services/device-change.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import type { DeviceChangeRequestStatus } from '../types/device-change.types.js';

function requireAdminUserId(req: Request): string {
  if (!req.adminUserId) {
    throw new AppError(401, 'Missing admin authentication token');
  }
  return req.adminUserId;
}

/**
 * GET /api/v1/admin/device-change-requests
 * Requests, newest first, filtered by `status` and/or `fieldExecutiveId`, with per-status counts.
 */
export function listDeviceChangeRequests(req: Request, res: Response, next: NextFunction): void {
  try {
    const { status, fieldExecutiveId } = req.query as {
      status?: DeviceChangeRequestStatus;
      fieldExecutiveId?: string;
    };

    res.json({
      success: true,
      data: deviceChangeService.listDeviceChangeRequestsForAdmin({ status, fieldExecutiveId }),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/device-change-requests/:requestId/approve
 * Approves the request and releases the executive's device binding.
 */
export function approveDeviceChangeRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const adminUserId = requireAdminUserId(req);
    const { note } = (req.body ?? {}) as { note?: string };

    const decided = deviceChangeService.approveDeviceChangeRequest(req.params.requestId, adminUserId, note);
    logger.info(
      { adminUserId, requestId: decided.id, fieldExecutiveId: decided.fieldExecutive.id },
      'Device change request approved',
    );

    res.json({ success: true, data: decided });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/device-change-requests/:requestId/reject
 * Rejects the request; the executive's binding is unchanged.
 */
export function rejectDeviceChangeRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    const adminUserId = requireAdminUserId(req);
    const { note } = (req.body ?? {}) as { note?: string };

    const decided = deviceChangeService.rejectDeviceChangeRequest(req.params.requestId, adminUserId, note);
    logger.info(
      { adminUserId, requestId: decided.id, fieldExecutiveId: decided.fieldExecutive.id },
      'Device change request rejected',
    );

    res.json({ success: true, data: decided });
  } catch (err) {
    next(err);
  }
}
