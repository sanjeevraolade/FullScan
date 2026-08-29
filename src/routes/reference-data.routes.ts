import { Router } from 'express';
import * as controller from '../controllers/reference-data.controller.js';

export const referenceDataRoutes = Router();

// GET /api/v1/reference-data — download all dropdown/option data (post-login)
referenceDataRoutes.get('/', controller.getReferenceData);
