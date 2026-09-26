import type { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * Portal-scoped CSP, replacing the app-wide helmet default for the browser portals
 * (`/admin`, `/fe`). The portals ship no inline script or style and load nothing
 * off-origin, so everything can stay locked to 'self'. `upgrade-insecure-requests`
 * is deliberately left out of the default set — it breaks the portals when the
 * server is reached over plain http on a LAN address during development.
 */
export function createPortalContentSecurityPolicy(): RequestHandler {
  return helmet.contentSecurityPolicy({
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
  });
}
