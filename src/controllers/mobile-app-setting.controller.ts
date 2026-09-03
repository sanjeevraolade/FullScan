import type { Request, Response, NextFunction } from 'express';
import * as mobileAppSettingService from '../services/mobile-app-setting.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/v1/admin/mobile-app-settings
 * All mobile app settings with the metadata the portal renders its form from.
 */
export function getAll(_req: Request, res: Response, next: NextFunction): void {
  try {
    const settings = mobileAppSettingService.getAllMobileAppSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/mobile-app-settings
 * Applies a batch of setting changes and returns the full, updated set.
 */
export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.adminUserId) {
      throw new AppError(401, 'Missing admin authentication token');
    }

    const { settings } = req.body;
    const updated = mobileAppSettingService.updateMobileAppSettings(settings, req.adminUserId);

    logger.info(
      { adminUserId: req.adminUserId, keys: settings.map((s: { key: string }) => s.key) },
      'Mobile app settings updated',
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
