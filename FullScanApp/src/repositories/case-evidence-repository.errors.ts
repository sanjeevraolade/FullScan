import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-evidence-repository.errors.ts';

/**
 * Why an evidence upload failed, normalized so callers never parse HTTP
 * statuses or axios error codes.
 *
 * - `caseClosed` — `409`: the component is no longer (or not yet) open to new
 *   evidence. Retrying cannot help.
 * - `rejected` — any other HTTP error status (`400`, `401`, `404`, `413`, `415`, `5xx`).
 * - `timeout` — no response within the upload timeout.
 * - `network` — no response at all: offline, connection reset, or the local
 *   file could not be read by the native networking layer (a purged temp file
 *   surfaces this way — without a file-system module it can't be told apart).
 * - `invalidResponse` — a success status whose body carries no evidence id.
 * - `invalidPhoto` — the local capture metadata can't be sent (non-finite
 *   coordinates or an invalid capture time); nothing was sent.
 * - `unexpected` — the request failed outside HTTP (e.g. reading the auth token).
 */
export type CaseEvidenceUploadFailureReason =
  | 'caseClosed'
  | 'rejected'
  | 'timeout'
  | 'network'
  | 'invalidResponse'
  | 'invalidPhoto'
  | 'unexpected';

/**
 * Thrown by `uploadCaseEvidence`. The message never carries the file path,
 * coordinates or response bodies — only the reason and the HTTP status.
 */
export class CaseEvidenceUploadError extends Error {
  readonly reason: CaseEvidenceUploadFailureReason;
  /** The HTTP status when the server answered, otherwise `null`. */
  readonly status: number | null;

  constructor(reason: CaseEvidenceUploadFailureReason, status: number | null = null) {
    super(`Evidence upload failed: ${reason}${status === null ? '' : ` (HTTP ${status})`}`);
    this.name = 'CaseEvidenceUploadError';
    this.reason = reason;
    this.status = status;
    LoggerService.warn(`${FILE_NAME}: CaseEvidenceUploadError: constructed`, { reason, status });
  }
}

/** Narrowing helper, mirroring `isLocationUnavailableError` / `isGeocodingFailedError`. */
export function isCaseEvidenceUploadError(error: unknown): error is CaseEvidenceUploadError {
  const isMatch = error instanceof CaseEvidenceUploadError;
  LoggerService.info(`${FILE_NAME}: isCaseEvidenceUploadError: error type checked`, { isMatch });
  return isMatch;
}
