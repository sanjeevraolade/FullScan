import express, { type Request, type RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

/**
 * JSON body parsing. Every route gets body-parser's default 100 kb limit, except the
 * mobile evidence upload (`POST /api/v1/cases/:caseId/evidence`), whose body carries a
 * photo as base64. That route parses its own body with a 14 MB limit, inside its route
 * and so after `authenticate` — an unauthenticated client can't make the server buffer
 * 14 MB. The app-wide parser therefore skips exactly that route.
 *
 * Parse failures (malformed JSON → 400, too large → 413) are rendered by `error-handler`.
 */

/** body-parser's default, kept explicit. */
export const DEFAULT_JSON_BODY_LIMIT_BYTES = 100 * 1024;

/** A 10 MB photo is ~13.4 MB as base64, plus a few hundred bytes of metadata. */
export const MOBILE_EVIDENCE_JSON_BODY_LIMIT_BYTES = 14 * 1024 * 1024;

/**
 * `POST /api/v1/cases/:caseId/evidence`, matched the way Express matches that route
 * (`:caseId` is one path segment, case-insensitive, optional trailing slash). If the
 * route moves, this must move with it — tests/mobile-evidence.test.ts fails otherwise.
 */
const MOBILE_EVIDENCE_UPLOAD_PATH = /^\/api\/v1\/cases\/[^/]+\/evidence\/?$/i;

function isMobileEvidenceUpload(req: Request): boolean {
  return req.method === 'POST' && MOBILE_EVIDENCE_UPLOAD_PATH.test(req.path);
}

const defaultJsonParser = express.json({ limit: DEFAULT_JSON_BODY_LIMIT_BYTES });

/** App-wide JSON parser (100 kb). Leaves the mobile evidence upload to `parseMobileEvidenceJson`. */
export const parseJsonBody: RequestHandler = (req, res, next) => {
  if (isMobileEvidenceUpload(req)) {
    next();
    return;
  }
  defaultJsonParser(req, res, next);
};

const mobileEvidenceJsonParser = express.json({ limit: MOBILE_EVIDENCE_JSON_BODY_LIMIT_BYTES });

/** The mobile evidence upload's body: `application/json` only (else 415), up to 14 MB. */
export const parseMobileEvidenceJson: RequestHandler = (req, res, next) => {
  if (!req.is('application/json')) {
    next(new AppError(415, 'Send the photo as application/json'));
    return;
  }
  mobileEvidenceJsonParser(req, res, next);
};
