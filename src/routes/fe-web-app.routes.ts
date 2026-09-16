import path from 'path';
import { createFeWebPageGuard } from '../middleware/authenticate-fe-web.js';
import { readFeWebSessionCookie } from '../utils/fe-web-session-cookie.js';
import { verifyFeWebToken } from '../services/fe-web-auth.service.js';
import { createSpaAppRoutes } from './spa-app.routes.js';

/** Where the React app is mounted. Must match `base` in `web-fe/vite.config.ts`. */
export const FE_WEB_APP_PATH = '/app';
export const FE_WEB_APP_LOGIN_PATH = `${FE_WEB_APP_PATH}/login`;

/**
 * The field executive React app (`web-fe/`, built by Vite) — the successor to the
 * static `/fe` portal, on the same `/api/v1/fe-web/*` API and cookie session.
 *
 * `FE_WEB_APP_DIR` overrides the build directory (tests use a fixture). Otherwise it
 * resolves relative to this file, which works from `src/` and `dist/` alike.
 */
export const feWebAppRoutes = createSpaAppRoutes({
  appPath: FE_WEB_APP_PATH,
  resolveBuildDir: () => process.env.FE_WEB_APP_DIR || path.join(__dirname, '..', '..', 'web-fe', 'dist'),
  buildCommand: 'npm run build:web',
  hasValidSession: (req) => {
    const token = readFeWebSessionCookie(req);
    return Boolean(token && verifyFeWebToken(token));
  },
  pageGuard: createFeWebPageGuard(FE_WEB_APP_LOGIN_PATH),
});
