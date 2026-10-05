import { LoggerService } from '@/infrastructure/logger';

import type { FileReadFailureReason } from './file-system.types';

const FILE_NAME = 'file-system.errors.ts';

/**
 * Thrown when a local file can't be read. The message never carries the file
 * path (it identifies evidence) or any of the file's content.
 */
export class FileReadError extends Error {
  readonly reason: FileReadFailureReason;

  constructor(reason: FileReadFailureReason) {
    super(`Local file could not be read: ${reason}`);
    this.name = 'FileReadError';
    this.reason = reason;
    LoggerService.warn(`${FILE_NAME}: FileReadError: constructed`, { reason });
  }
}

/** Narrowing helper, mirroring `isLocationUnavailableError` / `isGeocodingFailedError`. */
export function isFileReadError(error: unknown): error is FileReadError {
  const isMatch = error instanceof FileReadError;
  LoggerService.info(`${FILE_NAME}: isFileReadError: error type checked`, { isMatch });
  return isMatch;
}
