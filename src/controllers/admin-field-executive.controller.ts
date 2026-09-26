import type { Request, Response, NextFunction } from 'express';
import * as adminFieldExecutiveService from '../services/admin-field-executive.service.js';

/**
 * GET /api/v1/admin/field-executives
 * The roster, with assignment and detection counts — also the source for the
 * assignee dropdown on the case editor.
 */
export async function listFieldExecutives(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const executives = await adminFieldExecutiveService.listFieldExecutivesForAdmin(
      search || undefined,
    );
    res.json({ success: true, data: executives });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/field-executives/:fieldExecutiveId/history
 * Case-wise history for one executive, including every mock-location detection
 * recorded against the case it happened on.
 */
export async function getFieldExecutiveHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await adminFieldExecutiveService.getFieldExecutiveHistory(
      req.params.fieldExecutiveId,
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}
