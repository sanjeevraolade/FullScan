import path from 'path';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AppError } from '../utils/app-error.js';
import { authenticateAdminPage } from '../middleware/authenticate-admin.js';
import { readAdminSessionCookie } from '../utils/admin-session-cookie.js';
import { verifyAdminToken } from '../services/admin-auth.service.js';

/**
 * Serves the Admin Portal — a dependency-free static front end (HTML + CSS +
 * native ES modules) that talks to `/api/v1/admin/*`.
 *
 * Resolved relative to this file so it works both from `src/` under `tsx watch`
 * and from `dist/` after `npm run build`, which mirror the same depth.
 */
const PORTAL_DIR = path.join(__dirname, '..', '..', 'public', 'admin');

export const adminPortalRoutes = Router();

/**
 * Portal-scoped CSP, replacing the app-wide helmet default for these routes.
 * The portal ships no inline script and loads nothing off-origin, so everything
 * can stay locked to 'self'. `upgrade-insecure-requests` is deliberately left out
 * of the default set — it breaks the portal when the server is reached over plain
 * http on a LAN address during development.
 */
adminPortalRoutes.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
    },
  }),
);

/** Portal HTML must never be cached — a signed-out browser would otherwise re-serve the shell. */
function sendPortalPage(res: Response, fileName: string): void {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(PORTAL_DIR, fileName));
}

// GET /admin/login — the only unauthenticated page. An already-signed-in admin is
// bounced to the shell rather than shown the form again.
adminPortalRoutes.get('/login', (req: Request, res: Response): void => {
  const token = readAdminSessionCookie(req);

  if (token && verifyAdminToken(token)) {
    res.redirect('/admin');
    return;
  }

  sendPortalPage(res, 'login.html');
});

// Stylesheets and scripts — no session data, so served without the guard.
adminPortalRoutes.use('/assets', express.static(path.join(PORTAL_DIR, 'assets')));

// A missing asset is a missing asset: answer 404 here rather than letting the
// request fall through to the page catch-all and be served the shell HTML.
adminPortalRoutes.use('/assets', (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'Asset not found'));
});

// Every other /admin path is an authenticated page: the guard redirects to
// /admin/login when there is no valid session, so the shell is never delivered to
// an anonymous browser. In-portal navigation is hash-based, so one shell serves all.
adminPortalRoutes.get('*', authenticateAdminPage, (_req: Request, res: Response): void => {
  sendPortalPage(res, 'index.html');
});
