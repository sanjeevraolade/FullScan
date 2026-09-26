import 'express';
import type { AdminRole } from './admin.types.js';

declare module 'express' {
  interface Request {
    fieldExecutiveId?: string;
    adminUserId?: string;
    adminRole?: AdminRole;
  }
}
