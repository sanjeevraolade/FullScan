import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error.js';

/**
 * Multipart parsers for evidence uploads. Both buffer in memory (bounded by their
 * limits) so the service can check the real file type before anything reaches disk.
 */

/** Same per-file limit on every scope. */
export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const MAX_EVIDENCE_FILE_MB = MAX_EVIDENCE_FILE_BYTES / (1024 * 1024);

/* ------------------------------------------------------------ FE web portal */

/** Multipart field the web app sends its files under. */
export const EVIDENCE_FIELD_NAME = 'files';
export const MAX_EVIDENCE_FILES = 10;

const webEvidenceMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_EVIDENCE_FILES,
    fileSize: MAX_EVIDENCE_FILE_BYTES,
    fields: 0,
    parts: MAX_EVIDENCE_FILES,
  },
}).array(EVIDENCE_FIELD_NAME, MAX_EVIDENCE_FILES);

function toWebAppError(err: multer.MulterError): AppError {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(413, `Each file must be ${MAX_EVIDENCE_FILE_MB} MB or smaller`);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return new AppError(400, `Upload at most ${MAX_EVIDENCE_FILES} files at a time`);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(400, `Files must be sent in the "${EVIDENCE_FIELD_NAME}" field`);
    default:
      return new AppError(400, 'Invalid upload');
  }
}

/* ------------------------------------------------------------ mobile app */

/** Multipart part the app sends its one photo in. */
export const MOBILE_EVIDENCE_FILE_FIELD = 'file';

/**
 * Text parts accepted with a mobile capture. The contract has six; the limit leaves a
 * little room so an unknown extra part is reported by name by the body schema rather
 * than as "too many fields", while still bounding what is buffered.
 */
export const MAX_MOBILE_EVIDENCE_FIELDS = 10;

/** Longest text part value, in bytes — ample for a code, a number or an ISO timestamp. */
const MAX_MOBILE_EVIDENCE_FIELD_BYTES = 256;

const mobileEvidenceMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_EVIDENCE_FILE_BYTES,
    fields: MAX_MOBILE_EVIDENCE_FIELDS,
    fieldSize: MAX_MOBILE_EVIDENCE_FIELD_BYTES,
    parts: MAX_MOBILE_EVIDENCE_FIELDS + 1,
  },
}).single(MOBILE_EVIDENCE_FILE_FIELD);

function toMobileAppError(err: multer.MulterError): AppError {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(413, `The photo must be ${MAX_EVIDENCE_FILE_MB} MB or smaller`);
    case 'LIMIT_FILE_COUNT':
      return new AppError(400, 'Send exactly one photo per request');
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(400, `The photo must be sent in the "${MOBILE_EVIDENCE_FILE_FIELD}" part`);
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_PART_COUNT':
      return new AppError(400, 'Too many form fields');
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
      return new AppError(400, 'Form field too long');
    default:
      return new AppError(400, 'Invalid upload');
  }
}

/* ------------------------------------------------------------ shared */

/**
 * Wraps a multer handler: `415` unless the body is `multipart/form-data`, limit
 * breaches mapped to 4xx by `toAppError`, any other parse failure → `400`.
 */
function multipartEvidenceParser(
  parse: RequestHandler,
  toAppError: (err: multer.MulterError) => AppError,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.is('multipart/form-data')) {
      next(new AppError(415, 'Upload evidence as multipart/form-data'));
      return;
    }

    parse(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(toAppError(err));
        return;
      }
      if (err) {
        next(new AppError(400, 'Invalid upload'));
        return;
      }
      next();
    });
  };
}

/** FE web: up to 10 files in `files`, no text fields. */
export const parseEvidenceUpload = multipartEvidenceParser(webEvidenceMulter, toWebAppError);

/**
 * Mobile: exactly one file in `file`, plus a few text parts (`req.body`, all strings),
 * which the route validates after this runs.
 */
export const parseMobileEvidenceUpload = multipartEvidenceParser(mobileEvidenceMulter, toMobileAppError);
