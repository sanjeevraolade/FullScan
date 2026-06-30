import type { Request, Response, NextFunction } from 'express';
import * as uiConfigService from '../services/ui-config.service.js';

/**
 * GET /api/v1/ui-config
 * Download all screen configurations (called after login).
 */
export function getAll(req: Request, res: Response, next: NextFunction): void {
  try {
    const configs = uiConfigService.getAllScreenConfigs();
    res.json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/ui-config/:screenId
 * Download config for a specific screen.
 */
export function getByScreenId(req: Request, res: Response, next: NextFunction): void {
  try {
    const { screenId } = req.params;
    const config = uiConfigService.getScreenConfig(screenId);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/ui-config/:screenId
 * Update screen configuration (admin only).
 */
export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const { screenId } = req.params;
    const { title, components } = req.body;
    const config = uiConfigService.updateScreenConfig(screenId, title, components);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}
