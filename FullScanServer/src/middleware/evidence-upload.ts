import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error.js';

/** Multipart field the web app sends its files under. */
export const EVIDENCE_FIELD_NAME = 'files';
export const MAX_EVIDENCE_FILES = 10;
export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Buffers uploads in memory (bounded by the limits below) so the service can check
 * every file's real type before anything reaches disk.
 */
const evidenceMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_EVIDENCE_FILES,
    fileSize: MAX_EVIDENCE_FILE_BYTES,
    fields: 0,
    parts: MAX_EVIDENCE_FILES,
  },
}).array(EVIDENCE_FIELD_NAME, MAX_EVIDENCE_FILES);

function toAppError(err: multer.MulterError): AppError {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(413, `Each file must be ${MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)} MB or smaller`);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return new AppError(400, `Upload at most ${MAX_EVIDENCE_FILES} files at a time`);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(400, `Files must be sent in the "${EVIDENCE_FIELD_NAME}" field`);
    default:
      return new AppError(400, 'Invalid upload');
  }
}

/** Parses `multipart/form-data` evidence uploads, turning limit breaches into 4xx errors. */
export function parseEvidenceUpload(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    next(new AppError(415, 'Upload evidence as multipart/form-data'));
    return;
  }

  evidenceMulter(req, res, (err: unknown) => {
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
}
