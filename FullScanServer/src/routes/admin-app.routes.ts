import path from 'path';
import { createAdminPageGuard } from '../middleware/authenticate-admin.js';
import { readAdminSessionCookie } from '../utils/admin-session-cookie.js';
import { verifyAdminToken } from '../services/admin-auth.service.js';
import { createSpaAppRoutes } from './spa-app.routes.js';

/** Where the admin React app is mounted. Must match `base` in `web-admin/vite.config.ts`. */
export const ADMIN_APP_PATH = '/admin-app';
export const ADMIN_APP_LOGIN_PATH = `${ADMIN_APP_PATH}/login`;

/**
 * The admin React app (`web-admin/`, built by Vite) — runs alongside the static
 * `/admin` portal on the same `/api/v1/admin/*` API and `fs_admin_session` cookie.
 *
 * `ADMIN_APP_DIR` overrides the build directory (tests use a fixture).
 */
export const adminAppRoutes = createSpaAppRoutes({
  appPath: ADMIN_APP_PATH,
  resolveBuildDir: () => process.env.ADMIN_APP_DIR || path.join(__dirname, '..', '..', 'web-admin', 'dist'),
  buildCommand: 'npm run build:admin-web',
  hasValidSession: async (req) => {
    const token = readAdminSessionCookie(req);
    return Boolean(token && (await verifyAdminToken(token)));
  },
  pageGuard: createAdminPageGuard(ADMIN_APP_LOGIN_PATH),
});
