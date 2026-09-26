import type { Request, Response, NextFunction } from 'express';
import * as fieldExecutiveService from '../services/field-executive.service.js';

/**
 * GET /api/v1/me
 * Current logged-in field executive's profile.
 */
export async function getCurrentFieldExecutive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fieldExecutive = await fieldExecutiveService.getCurrentFieldExecutive(req.fieldExecutiveId!);
    res.json({ success: true, data: fieldExecutive });
  } catch (err) {
    next(err);
  }
}
