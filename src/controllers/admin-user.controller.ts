import type { Request, Response, NextFunction } from 'express';
import * as adminUserService from '../services/admin-user.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import type { AdminRole, UpdateAdminUserInput } from '../types/admin.types.js';

/**
 * GET /api/v1/admin/admin-users
 * Every admin account — super admin only.
 */
export async function listAdminUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await adminUserService.listAdminUsers() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/admin-users
 * Adds an admin by email — super admin only. Answers 201 with the account and its
 * one-time temporary password.
 */
export async function createAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.adminUserId) {
      throw new AppError(401, 'Missing admin authentication token');
    }

    // `validate()` checks but does not transform, so the role default is applied here.
    const { name, email, role } = req.body as { name: string; email: string; role?: AdminRole };
    const result = await adminUserService.createAdminUser(
      { name, email, role: role ?? 'admin' },
      req.adminUserId,
    );

    // The email is the new admin's sign-in identifier — log the id, never the password.
    logger.info(
      { adminUserId: req.adminUserId, createdAdminUserId: result.adminUser.id, role: result.adminUser.role },
      'Admin user created by super admin',
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/admin-users/:adminUserId
 * Promotes/demotes and/or deactivates/reactivates another admin — super admin only.
 */
export async function updateAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.adminUserId) {
      throw new AppError(401, 'Missing admin authentication token');
    }

    const { role, isActive } = req.body as UpdateAdminUserInput;
    const updated = await adminUserService.updateAdminUser(
      req.params.adminUserId,
      { role, isActive },
      req.adminUserId,
    );

    logger.info(
      { adminUserId: req.adminUserId, targetAdminUserId: updated.id, role, isActive },
      'Admin user updated by super admin',
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/admin-users/:adminUserId
 * Permanently deletes another admin with no audit history — super admin only.
 */
export async function deleteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.adminUserId) {
      throw new AppError(401, 'Missing admin authentication token');
    }

    const { adminUserId: targetAdminUserId } = req.params;
    await adminUserService.deleteAdminUser(targetAdminUserId, req.adminUserId);

    logger.info(
      { adminUserId: req.adminUserId, targetAdminUserId },
      'Admin user deleted by super admin',
    );

    res.json({ success: true, data: { deleted: true, id: targetAdminUserId } });
  } catch (err) {
    next(err);
  }
}
