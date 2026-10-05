import 'express';
import type { AdminRole } from './admin.types.js';

declare module 'express' {
  interface Request {
    fieldExecutiveId?: string;
    /** Set by the mobile `authenticate` middleware: the verified token's session version. */
    mobileSessionVersion?: number;
    adminUserId?: string;
    adminRole?: AdminRole;
  }
}
