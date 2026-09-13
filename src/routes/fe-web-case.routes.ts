import { Router } from 'express';
import * as controller from '../controllers/fe-web-case.controller.js';

export const feWebCaseRoutes = Router();

// GET /api/v1/fe-web/cases — the signed-in FE's Pending, Beyond TAT and Completed cases (read-only)
feWebCaseRoutes.get('/', controller.getMyCases);
