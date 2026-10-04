import { Router } from 'express';
import * as controller from '../controllers/reference-data.controller.js';

export const referenceDataRoutes = Router();

// GET /api/v1/master-data — download all dropdown/option data + mobile app settings, with the
// master-data version (updatedAt) they belong to (post-login, skipped by the app when unchanged)
referenceDataRoutes.get('/', controller.getReferenceData);
