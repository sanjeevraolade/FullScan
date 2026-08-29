import 'express';

declare module 'express' {
  interface Request {
    fieldExecutiveId?: string;
  }
}
