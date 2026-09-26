import path from 'path';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { AppError } from '../utils/app-error.js';
import { authenticateFeWebPage } from '../middleware/authenticate-fe-web.js';
import { createPortalContentSecurityPolicy } from '../middleware/portal-csp.js';
import { readFeWebSessionCookie } from '../utils/fe-web-session-cookie.js';
import { verifyFeWebToken } from '../services/fe-web-auth.service.js';

/**
 * Serves the Field Executive web portal — a dependency-free static front end that
 * talks to `/api/v1/fe-web/*`. It shares the Admin Portal's stylesheet and DOM
 * helpers (served unguarded from `/admin/assets`), so both read as one product.
 *
 * Resolved relative to this file so it works both from `src/` under `tsx watch`
 * and from `dist/` after `npm run build`, which mirror the same depth.
 */
const PORTAL_DIR = path.join(__dirname, '..', '..', 'public', 'fe');

export const feWebPortalRoutes = Router();

feWebPortalRoutes.use(createPortalContentSecurityPolicy());

/** Portal HTML must never be cached — a signed-out browser would otherwise re-serve the shell. */
function sendPortalPage(res: Response, fileName: string): void {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(PORTAL_DIR, fileName));
}

// GET /fe/login — the only unauthenticated page. An already-signed-in field
// executive is bounced to the portal rather than shown the form again.
feWebPortalRoutes.get('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = readFeWebSessionCookie(req);

  try {
    if (token && (await verifyFeWebToken(token))) {
      res.redirect('/fe');
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  sendPortalPage(res, 'login.html');
});

// Stylesheets and scripts — no session data, so served without the guard.
feWebPortalRoutes.use('/assets', express.static(path.join(PORTAL_DIR, 'assets')));

// A missing asset answers 404 rather than falling through to the page catch-all.
feWebPortalRoutes.use('/assets', (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'Asset not found'));
});

// Every other /fe path is an authenticated page, guarded server-side.
feWebPortalRoutes.get('*', authenticateFeWebPage, (_req: Request, res: Response): void => {
  sendPortalPage(res, 'index.html');
});
