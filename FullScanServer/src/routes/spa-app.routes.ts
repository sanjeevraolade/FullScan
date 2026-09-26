import fs from 'fs';
import path from 'path';
import express, { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { AppError } from '../utils/app-error.js';
import { createPortalContentSecurityPolicy } from '../middleware/portal-csp.js';

export interface SpaAppRouteOptions {
  /** Mount path, e.g. `/app`. Must match `base` in the app's vite.config.ts. */
  readonly appPath: string;
  /** Build output directory, resolved per request so tests can point it at a fixture. */
  readonly resolveBuildDir: () => string;
  /** Shown in the 503 when the app has not been built. */
  readonly buildCommand: string;
  /** Whether the request already carries a valid session for this app. */
  readonly hasValidSession: (req: Request) => Promise<boolean>;
  /** Redirects an unauthenticated page request to `<appPath>/login`. */
  readonly pageGuard: RequestHandler;
}

/**
 * Serves a Vite-built single-page app. Every page path answers with the one
 * `index.html` shell and React Router picks the screen:
 *
 * - `<appPath>/login` is the only page served without a session; a signed-in
 *   browser is sent into the app instead.
 * - `<appPath>/assets/*` are hashed build files with no session data — served
 *   unguarded and cached for good. A missing one is a 404, never the shell.
 * - Everything else is guarded server-side before any HTML is sent.
 *
 * The shell is `no-store` and the portal CSP (everything `'self'`) applies.
 */
export function createSpaAppRoutes(options: SpaAppRouteOptions): Router {
  const routes = Router();

  routes.use(createPortalContentSecurityPolicy());

  const sendShell = (res: Response, next: NextFunction): void => {
    const shellPath = path.join(options.resolveBuildDir(), 'index.html');

    if (!fs.existsSync(shellPath)) {
      next(new AppError(503, `The web app has not been built. Run \`${options.buildCommand}\`.`));
      return;
    }

    res.set('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(shellPath);
  };

  routes.get('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (await options.hasValidSession(req)) {
        res.redirect(options.appPath);
        return;
      }
    } catch (err) {
      next(err);
      return;
    }
    sendShell(res, next);
  });

  routes.use('/assets', (req: Request, res: Response, next: NextFunction): void => {
    express.static(path.join(options.resolveBuildDir(), 'assets'), { immutable: true, maxAge: '1y' })(
      req,
      res,
      next,
    );
  });

  routes.use('/assets', (_req: Request, _res: Response, next: NextFunction): void => {
    next(new AppError(404, 'Asset not found'));
  });

  routes.get('*', options.pageGuard, (_req: Request, res: Response, next: NextFunction): void => {
    sendShell(res, next);
  });

  return routes;
}
