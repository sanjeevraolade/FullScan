import axios from 'axios';
import type { AxiosResponse } from 'axios';

import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { CapturedPhotoEvidence, UploadedCaseEvidence } from '@/domain/case';

import { CaseEvidenceUploadError } from './case-evidence-repository.errors';

const FILE_NAME = 'case-evidence-repository.ts';

/**
 * A watermarked photo is several MB over a field connection — far more than
 * the API client's 15 s default allows for. Applied to this request only.
 */
export const EVIDENCE_UPLOAD_TIMEOUT_MS = 60000;

const EVIDENCE_MIME_TYPE = 'image/jpeg';
const EVIDENCE_FILE_EXTENSION = 'jpg';
const MULTIPART_CONTENT_TYPE = 'multipart/form-data';

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_CONFLICT = 409;

/** axios reports its own timeout as `ECONNABORTED`; `ETIMEDOUT` is the transitional/socket form. */
const TIMEOUT_ERROR_CODES: readonly string[] = ['ECONNABORTED', 'ETIMEDOUT'];

/** Anything already carrying a scheme (`file://`, `content://`, …) is a URI the native layer can open as-is. */
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/** The server's usual `YYYY-MM-DD HH:MM:SS` timestamp — UTC, but without a zone designator. */
const SERVER_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

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

/** One multipart text part: the contract's field name and its string value. */
type EvidenceTextPart = readonly [name: string, value: string];

/**
 * Refuses, before anything is sent, a photo whose metadata can't be
 * serialized into the contract's text parts. Every capture should pass —
 * this guards against a corrupted draft rather than a normal path.
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

/**
 * The native networking layer opens the file part by URI. The camera saves a
 * plain path, so it gets the `file://` scheme — but never twice.
 */
function toFileUri(filePath: string): string {
  const hasUriScheme = URI_SCHEME_PATTERN.test(filePath);
  // The path itself is evidence and never logged.
  LoggerService.info(`${FILE_NAME}: toFileUri: resolving file part URI`, { hasUriScheme });
  return hasUriScheme ? filePath : `file://${filePath}`;
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

/** The contract's six text parts, by their exact names. The server rejects any other part. */
function buildEvidenceTextParts(photo: CapturedPhotoEvidence): readonly EvidenceTextPart[] {
  LoggerService.info(`${FILE_NAME}: buildEvidenceTextParts: serializing capture metadata`, {
    documentTypeCode: photo.documentTypeCode,
    isMockLocation: photo.isMockLocation,
  });
  return [
    ['documentTypeCode', photo.documentTypeCode],
    ['latitude', String(photo.latitude)],
    ['longitude', String(photo.longitude)],
    ['accuracyMeters', String(photo.accuracyMeters)],
    ['capturedAt', photo.capturedAt.toISOString()],
    ['isMockLocation', photo.isMockLocation ? 'true' : 'false'],
  ];
}

/**
 * React Native's `FormData`: a file part is a `{ uri, name, type }` object
 * the native layer streams from disk. Text parts go first so a streaming
 * multipart parser already has the metadata when the file arrives.
 */
function buildEvidenceFormData(photo: CapturedPhotoEvidence): FormData {
  const textParts = buildEvidenceTextParts(photo);
  const formData = new FormData();
  textParts.forEach(([name, value]) => formData.append(name, value));
  formData.append('file', {
    uri: toFileUri(photo.filePath),
    name: buildEvidenceFileName(photo),
    type: EVIDENCE_MIME_TYPE,
  });
  LoggerService.info(`${FILE_NAME}: buildEvidenceFormData: multipart body assembled`, {
    documentTypeCode: photo.documentTypeCode,
    textPartCount: textParts.length,
    filePartCount: 1,
  });
  return formData;
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
function readEvidenceDto(
  response: AxiosResponse<ApiEnvelope<CaseEvidenceDto> | null>,
): CaseEvidenceDto | null {
  const envelope = response.data;
  const dto = typeof envelope === 'object' && envelope !== null ? envelope.data ?? null : null;
  const hasEvidenceId = dto !== null && typeof dto.id === 'string' && dto.id.length > 0;
  LoggerService.info(`${FILE_NAME}: readEvidenceDto: reading response body`, {
    status: response.status,
    hasData: dto !== null,
    hasEvidenceId,
  });
  return hasEvidenceId ? dto : null;
}

/**
 * Uploads one captured photo as case evidence. Resolves with the server's
 * record for both `201` (stored now) and `200` (these exact bytes were already
 * stored — a safe retry). Rejects with `CaseEvidenceUploadError` only.
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
  const formData = buildEvidenceFormData(photo);

  let response: AxiosResponse<ApiEnvelope<CaseEvidenceDto> | null>;
  try {
    response = await apiClient.post<ApiEnvelope<CaseEvidenceDto> | null>(
      `/cases/${caseId}/evidence`,
      formData,
      {
        /*
         * No boundary here — React Native's native networking layer writes the
         * multipart body and its boundary itself. Naming the type explicitly
         * keeps axios's default request transform from ever JSON-encoding the
         * FormData (it only does so under a JSON content type), and axios
         * drops this header again for an RN FormData so the native layer's
         * `multipart/form-data; boundary=…` is what goes on the wire.
         */
        headers: { 'Content-Type': MULTIPART_CONTENT_TYPE },
        timeout: EVIDENCE_UPLOAD_TIMEOUT_MS,
      },
    );
  } catch (error: unknown) {
    throw toUploadError(caseId, photo.documentTypeCode, error);
  }

  if (response.status !== HTTP_OK && response.status !== HTTP_CREATED) {
    LoggerService.error(`${FILE_NAME}: uploadCaseEvidence: unexpected success status`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      status: response.status,
    });
    throw new CaseEvidenceUploadError('invalidResponse', response.status);
  }
  const dto = readEvidenceDto(response);
  if (dto === null) {
    LoggerService.error(
      `${FILE_NAME}: uploadCaseEvidence: success response without an evidence id`,
      {
        caseId,
        documentTypeCode: photo.documentTypeCode,
        status: response.status,
      },
    );
    throw new CaseEvidenceUploadError('invalidResponse', response.status);
  }

  const evidence = mapUploadedCaseEvidence(dto, response.status === HTTP_OK);
  LoggerService.info(`${FILE_NAME}: uploadCaseEvidence: photo uploaded`, {
    caseId,
    documentTypeCode: photo.documentTypeCode,
    status: response.status,
    evidenceId: evidence.id,
    wasAlreadyUploaded: evidence.wasAlreadyUploaded,
  });
  return evidence;
}
