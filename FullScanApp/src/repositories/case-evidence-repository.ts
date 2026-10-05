import axios from 'axios';

import { apiClient } from '@/infrastructure/networking';
import { FileSystemService, isFileReadError } from '@/infrastructure/filesystem';
import { LoggerService } from '@/infrastructure/logger';
import type { CapturedPhotoEvidence, UploadedCaseEvidence } from '@/domain/case';

import { CaseEvidenceUploadError } from './case-evidence-repository.errors';

const FILE_NAME = 'case-evidence-repository.ts';

/**
 * A watermarked photo is several MB — over a third more as base64 — on a field
 * connection, far more than the API client's 15 s default allows for. Applied
 * to this request only.
 */
export const EVIDENCE_UPLOAD_TIMEOUT_MS = 60000;

const EVIDENCE_FILE_EXTENSION = 'jpg';
const JSON_CONTENT_TYPE = 'application/json';

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_CONFLICT = 409;

/** axios reports its own timeout as `ECONNABORTED`; `ETIMEDOUT` is the transitional/socket form. */
const TIMEOUT_ERROR_CODES: readonly string[] = ['ECONNABORTED', 'ETIMEDOUT'];

/** The server's usual `YYYY-MM-DD HH:MM:SS` timestamp — UTC, but without a zone designator. */
const SERVER_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * `POST /cases/:caseId/evidence` body. The server schema is strict: exactly
 * these fields, numbers and booleans as real JSON types.
 */
interface CaseEvidenceUploadRequestDto {
  readonly documentTypeCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAt: string;
  readonly isMockLocation: boolean;
  readonly fileName: string;
  /** The JPEG's bytes, standard base64, no `data:` prefix. Never logged, only its length. */
  readonly contentBase64: string;
}

/** `POST /cases/:caseId/evidence` → `data`, for both `201` (stored) and `200` (already stored). */
interface CaseEvidenceDto {
  readonly id: string;
  readonly componentId: string;
  readonly source: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly documentTypeCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly isMockLocation: boolean;
  readonly capturedAt: string;
  readonly uploadedAt: string;
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T | null;
}

/** Only what the caller needs from the response — see `sendEvidence` for why. */
interface EvidenceUploadReply {
  readonly status: number;
  readonly envelope: ApiEnvelope<CaseEvidenceDto> | null;
}

/**
 * Refuses, before anything is read or sent, a photo whose metadata can't be
 * sent. Every capture should pass — this guards against a corrupted draft
 * rather than a normal path.
 */
function assertUploadablePhoto(caseId: string, photo: CapturedPhotoEvidence): void {
  const isUploadable =
    photo.filePath.length > 0 &&
    photo.documentTypeCode.length > 0 &&
    Number.isFinite(photo.latitude) &&
    Number.isFinite(photo.longitude) &&
    Number.isFinite(photo.accuracyMeters) &&
    !Number.isNaN(photo.capturedAt.getTime());
  // Coordinates and the path are evidence — only which check failed is logged.
  LoggerService.info(`${FILE_NAME}: assertUploadablePhoto: photo metadata checked`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
    isUploadable,
  });
  if (!isUploadable) {
    LoggerService.error(`${FILE_NAME}: assertUploadablePhoto: photo metadata unusable — not sent`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      hasFilePath: photo.filePath.length > 0,
      hasDocumentTypeCode: photo.documentTypeCode.length > 0,
      hasFiniteCoordinates: Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude),
      hasFiniteAccuracy: Number.isFinite(photo.accuracyMeters),
      hasValidCaptureTime: !Number.isNaN(photo.capturedAt.getTime()),
    });
    throw new CaseEvidenceUploadError('invalidPhoto');
  }
}

/** Display name only — the server sanitizes it and stores the bytes under its own id. */
function buildEvidenceFileName(photo: CapturedPhotoEvidence): string {
  const fileName = `${
    photo.documentTypeCode
  }-${photo.capturedAt.getTime()}.${EVIDENCE_FILE_EXTENSION}`;
  LoggerService.info(`${FILE_NAME}: buildEvidenceFileName: built display name`, {
    documentTypeCode: photo.documentTypeCode,
  });
  return fileName;
}

/**
 * The photo's bytes exactly as the camera saved them — read, never decoded or
 * re-compressed, so the server hashes the very bytes that were captured. A
 * file that can't be read (e.g. purged from the OS temp directory) fails here,
 * before any request.
 */
async function readPhotoContent(caseId: string, photo: CapturedPhotoEvidence): Promise<string> {
  LoggerService.info(`${FILE_NAME}: readPhotoContent: reading photo bytes`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
  });
  try {
    const contentBase64 = await FileSystemService.readFileAsBase64(photo.filePath);
    LoggerService.info(`${FILE_NAME}: readPhotoContent: photo bytes read`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      base64Length: contentBase64.length,
    });
    return contentBase64;
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: readPhotoContent: photo file unreadable — not sent`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      readFailureReason: isFileReadError(error) ? error.reason : 'unknown',
    });
    throw new CaseEvidenceUploadError('fileUnreadable');
  }
}

function buildEvidenceUploadBody(
  photo: CapturedPhotoEvidence,
  contentBase64: string,
): CaseEvidenceUploadRequestDto {
  LoggerService.info(`${FILE_NAME}: buildEvidenceUploadBody: assembling request body`, {
    documentTypeCode: photo.documentTypeCode,
    isMockLocation: photo.isMockLocation,
    base64Length: contentBase64.length,
  });
  return {
    documentTypeCode: photo.documentTypeCode,
    latitude: photo.latitude,
    longitude: photo.longitude,
    accuracyMeters: photo.accuracyMeters,
    capturedAt: photo.capturedAt.toISOString(),
    isMockLocation: photo.isMockLocation,
    fileName: buildEvidenceFileName(photo),
    contentBase64,
  };
}

/** Normalizes whatever the request rejected with into the one error type callers branch on. */
function toUploadError(
  caseId: string,
  documentTypeCode: string,
  error: unknown,
): CaseEvidenceUploadError {
  if (!axios.isAxiosError(error)) {
    // Not from the transport (e.g. the auth interceptor) — its message is not safe to log.
    LoggerService.error(`${FILE_NAME}: toUploadError: unexpected non-HTTP failure`, {
      caseId,
      documentTypeCode,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return new CaseEvidenceUploadError('unexpected');
  }
  const status = error.response?.status ?? null;
  if (status === HTTP_CONFLICT) {
    LoggerService.warn(`${FILE_NAME}: toUploadError: case is closed to new evidence`, {
      caseId,
      documentTypeCode,
      status,
    });
    return new CaseEvidenceUploadError('caseClosed', status);
  }
  if (status !== null) {
    LoggerService.error(`${FILE_NAME}: toUploadError: server rejected the upload`, {
      caseId,
      documentTypeCode,
      status,
    });
    return new CaseEvidenceUploadError('rejected', status);
  }
  const isTimeout = error.code !== undefined && TIMEOUT_ERROR_CODES.includes(error.code);
  LoggerService.error(`${FILE_NAME}: toUploadError: no response from the server`, {
    caseId,
    documentTypeCode,
    code: error.code ?? null,
    isTimeout,
  });
  return new CaseEvidenceUploadError(isTimeout ? 'timeout' : 'network');
}

/**
 * Reads the photo, posts it and hands back only the status and envelope.
 * The base64 string, the request body and axios's response/error objects
 * (whose `config.data` is a second, serialized copy of the body) all stay
 * inside this call, so none of them outlives the request — one photo's
 * content in memory at a time.
 */
async function sendEvidence(
  caseId: string,
  photo: CapturedPhotoEvidence,
): Promise<EvidenceUploadReply> {
  LoggerService.info(`${FILE_NAME}: sendEvidence: sending photo`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
  });
  const body = buildEvidenceUploadBody(photo, await readPhotoContent(caseId, photo));
  try {
    const response = await apiClient.post<ApiEnvelope<CaseEvidenceDto> | null>(
      `/cases/${caseId}/evidence`,
      body,
      {
        // axios would infer JSON from a plain object anyway; stated so the
        // route's `415 Not application/json` can never be hit by accident.
        headers: { 'Content-Type': JSON_CONTENT_TYPE },
        timeout: EVIDENCE_UPLOAD_TIMEOUT_MS,
      },
    );
    LoggerService.info(`${FILE_NAME}: sendEvidence: response received`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      status: response.status,
    });
    return { status: response.status, envelope: response.data };
  } catch (error: unknown) {
    throw toUploadError(caseId, photo.documentTypeCode, error);
  }
}

/**
 * The server's `YYYY-MM-DD HH:MM:SS` is UTC; parsing it as-is would read it
 * as device-local time. An ISO string (with its own zone) is taken as given.
 * Unparseable values come back as an invalid `Date` with a warning, like
 * `case-repository`'s `mapNullableDate` — the upload itself still succeeded.
 */
function parseServerTimestamp(value: string): Date {
  const isServerFormat = SERVER_TIMESTAMP_PATTERN.test(value);
  const parsed = new Date(isServerFormat ? `${value.replace(' ', 'T')}Z` : value);
  if (Number.isNaN(parsed.getTime())) {
    LoggerService.warn(`${FILE_NAME}: parseServerTimestamp: unparseable timestamp`, {
      isServerFormat,
    });
    return parsed;
  }
  LoggerService.info(`${FILE_NAME}: parseServerTimestamp: parsed timestamp`, { isServerFormat });
  return parsed;
}

function mapUploadedCaseEvidence(
  dto: CaseEvidenceDto,
  wasAlreadyUploaded: boolean,
): UploadedCaseEvidence {
  // Coordinates are evidence and the file name embeds nothing useful — ids, codes and sizes only.
  LoggerService.info(`${FILE_NAME}: mapUploadedCaseEvidence: mapping evidence record`, {
    evidenceId: dto.id,
    caseId: dto.componentId,
    documentTypeCode: dto.documentTypeCode,
    sizeBytes: dto.sizeBytes,
    wasAlreadyUploaded,
  });
  if (dto.isMockLocation) {
    LoggerService.warn(`${FILE_NAME}: mapUploadedCaseEvidence: server recorded a mock location`, {
      evidenceId: dto.id,
    });
  }
  return {
    id: dto.id,
    caseId: dto.componentId,
    fileName: dto.fileName,
    mimeType: dto.mimeType,
    sizeBytes: dto.sizeBytes,
    sha256: dto.sha256,
    documentTypeCode: dto.documentTypeCode,
    latitude: dto.latitude,
    longitude: dto.longitude,
    accuracyMeters: dto.accuracyMeters,
    isMockLocation: dto.isMockLocation,
    capturedAt: parseServerTimestamp(dto.capturedAt),
    uploadedAt: parseServerTimestamp(dto.uploadedAt),
    wasAlreadyUploaded,
  };
}

/**
 * The evidence record out of a success response, or `null` when the body
 * holds no usable id — a receipt can't be recorded without one.
 */
function readEvidenceDto(reply: EvidenceUploadReply): CaseEvidenceDto | null {
  const { envelope } = reply;
  const dto = typeof envelope === 'object' && envelope !== null ? envelope.data ?? null : null;
  const hasEvidenceId = dto !== null && typeof dto.id === 'string' && dto.id.length > 0;
  LoggerService.info(`${FILE_NAME}: readEvidenceDto: reading response body`, {
    status: reply.status,
    hasData: dto !== null,
    hasEvidenceId,
  });
  return hasEvidenceId ? dto : null;
}

/**
 * Uploads one captured photo as case evidence, base64 inside a JSON body.
 * Resolves with the server's record for both `201` (stored now) and `200`
 * (these exact bytes were already stored — a safe retry). Rejects with
 * `CaseEvidenceUploadError` only; an unreadable local file rejects before any
 * request is sent.
 */
export async function uploadCaseEvidence(
  caseId: string,
  photo: CapturedPhotoEvidence,
): Promise<UploadedCaseEvidence> {
  LoggerService.info(`${FILE_NAME}: uploadCaseEvidence: uploading photo`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
  });
  assertUploadablePhoto(caseId, photo);
  const reply = await sendEvidence(caseId, photo);

  if (reply.status !== HTTP_OK && reply.status !== HTTP_CREATED) {
    LoggerService.error(`${FILE_NAME}: uploadCaseEvidence: unexpected success status`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      status: reply.status,
    });
    throw new CaseEvidenceUploadError('invalidResponse', reply.status);
  }
  const dto = readEvidenceDto(reply);
  if (dto === null) {
    LoggerService.error(
      `${FILE_NAME}: uploadCaseEvidence: success response without an evidence id`,
      {
        caseId,
        documentTypeCode: photo.documentTypeCode,
        status: reply.status,
      },
    );
    throw new CaseEvidenceUploadError('invalidResponse', reply.status);
  }

  const evidence = mapUploadedCaseEvidence(dto, reply.status === HTTP_OK);
  LoggerService.info(`${FILE_NAME}: uploadCaseEvidence: photo uploaded`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
    status: reply.status,
    evidenceId: evidence.id,
    wasAlreadyUploaded: evidence.wasAlreadyUploaded,
  });
  return evidence;
}
