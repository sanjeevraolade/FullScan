import { Router } from 'express';
import * as controller from '../controllers/ui-config.controller.js';
import { validate } from '../middleware/validate.js';
import { updateUiConfigSchema } from './schemas/ui-config.schema.js';

export const uiConfigRoutes = Router();

// GET /api/v1/ui-config — download all screen configs (post-login)
uiConfigRoutes.get('/', controller.getAll);

// GET /api/v1/ui-config/:screenId — download single screen config
uiConfigRoutes.get('/:screenId', controller.getByScreenId);

// PUT /api/v1/ui-config/:screenId — update screen config (admin only)
uiConfigRoutes.put('/:screenId', validate(updateUiConfigSchema), controller.update);
