import { Router } from 'express';
import * as controller from '../controllers/admin-user.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createAdminUserSchema,
  deleteAdminUserSchema,
  updateAdminUserSchema,
} from './schemas/admin.schema.js';

/** Mounted behind `authenticateAdmin` + `requireAdminRole('super_admin')` — see app.ts. */
export const adminUserRoutes = Router();

// GET /api/v1/admin/admin-users — every admin account
adminUserRoutes.get('/', controller.listAdminUsers);

// POST /api/v1/admin/admin-users — add an admin by email, returns a one-time temporary password
adminUserRoutes.post('/', validate(createAdminUserSchema), controller.createAdminUser);

// PATCH /api/v1/admin/admin-users/:adminUserId — promote/demote, deactivate/reactivate
adminUserRoutes.patch('/:adminUserId', validate(updateAdminUserSchema), controller.updateAdminUser);

// DELETE /api/v1/admin/admin-users/:adminUserId — permanently delete (refused if it has audit history)
adminUserRoutes.delete('/:adminUserId', validate(deleteAdminUserSchema), controller.deleteAdminUser);
