import { Router } from 'express';
import * as controller from '../controllers/field-executive.controller.js';

export const meRoutes = Router();

// GET /api/v1/me — current field executive's profile
meRoutes.get('/', controller.getCurrentFieldExecutive);
