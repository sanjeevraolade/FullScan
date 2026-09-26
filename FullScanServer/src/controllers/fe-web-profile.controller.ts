import type { Request, Response, NextFunction } from 'express';
import * as feWebProfileService from '../services/fe-web-profile.service.js';
import { AppError } from '../utils/app-error.js';

/**
 * GET /api/v1/fe-web/profile
 * The signed-in field executive's profile and the mobile device their account is bound to.
 */
export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.fieldExecutiveId) {
      throw new AppError(401, 'Missing field executive web session');
    }

    const profile = await feWebProfileService.getProfileForFieldExecutive(req.fieldExecutiveId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}
