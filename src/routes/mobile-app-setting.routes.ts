import { Router } from 'express';
import * as controller from '../controllers/mobile-app-setting.controller.js';
import { validate } from '../middleware/validate.js';
import { updateMobileAppSettingsSchema } from './schemas/admin.schema.js';

/** Mounted behind `authenticateAdmin` — see app.ts. */
export const mobileAppSettingRoutes = Router();

// GET /api/v1/admin/mobile-app-settings — all settings + render metadata
mobileAppSettingRoutes.get('/', controller.getAll);

// PUT /api/v1/admin/mobile-app-settings — apply a batch of changes
mobileAppSettingRoutes.put('/', validate(updateMobileAppSettingsSchema), controller.update);
