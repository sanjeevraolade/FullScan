import { v4 as uuidv4 } from 'uuid';
import * as caseDao from '../db/case.dao.js';
import * as caseEvidenceDao from '../db/case-evidence.dao.js';
import { DuplicateMobileCaptureError, type NewMobileCaptureEvidenceRow } from '../db/case-evidence.dao.js';
import * as referenceDataDao from '../db/reference-data.dao.js';
import { formatTimestamp } from '../db/timestamp.js';
import {
  canUploadEvidence,
  detectEvidenceMimeType,
  sha256Hex,
  toDisplayName,
  toMobileCaptureEvidence,
  toStoragePath,
  writeEvidenceFiles,
} from './case-evidence.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  EvidenceUploadFile,
  MobileCaptureEvidenceRow,
  MobileCaptureMetadata,
  MobileEvidenceUploadResult,
} from '../types/case-evidence.types.js';

/**
 * `POST /cases/:caseId/evidence` — one camera photo from the app, with its capture
 * metadata. See docs/api-contracts/mobile-evidence-upload.md.
 */

/**
 * The component, if it is assigned to this executive. Anything else — unknown id,
 * someone else's component — is the same 404, so the route cannot probe for ids.
 */
async function findAssignedComponent(fieldExecutiveId: string, componentId: string): Promise<CaseComponentRow> {
  const row = await caseDao.findComponentById(componentId);

  if (!row || row.assigned_field_executive_id !== fieldExecutiveId) {
    throw new AppError(404, 'Case not found');
  }

  return row;
}

/** Only open work (Pending, Beyond TAT) takes new evidence. */
function assertOpenForEvidence(row: CaseComponentRow): void {
  if (row.bucket === 'new') {
    throw new AppError(409, 'Accept the case before adding evidence');
  }

  if (!canUploadEvidence(row)) {
    throw new AppError(409, 'Evidence can no longer be added to a completed case');
  }
}

async function assertKnownPhotoType(documentTypeCode: string): Promise<void> {
  const photoTypes = await referenceDataDao.findDropdownOptionsByCategory('photo_type');

  if (!photoTypes.some((option) => option.code === documentTypeCode)) {
    throw new AppError(400, 'Unknown documentTypeCode');
  }
}

/** The device's ISO 8601 capture time, in the stored timestamp format. Not checked against server time. */
function toCapturedAt(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'capturedAt must be an ISO 8601 datetime with an offset or Z');
  }

  return formatTimestamp(date);
}

/** `concurrent`: found by losing the insert race on the unique index rather than by the lookup. */
function replayed(
  row: MobileCaptureEvidenceRow,
  fieldExecutiveId: string,
  concurrent: boolean,
): MobileEvidenceUploadResult {
  logger.info(
    { fieldExecutiveId, componentId: row.component_id, evidenceId: row.id, concurrent },
    'Mobile evidence already recorded; returning the existing record',
  );
  return { evidence: toMobileCaptureEvidence(row), isNew: false };
}

/**
 * Records one mobile capture against a component assigned to the executive.
 *
 * Idempotent by content: if the component already has a mobile capture with the same
 * SHA-256, nothing is written and that record is returned (`isNew: false`) — first
 * write wins, the replay's metadata is ignored. A concurrent duplicate that loses the
 * insert race on the partial unique index gets the winner's record the same way.
 *
 * All-or-nothing: the file is written only after every check, and removed again if
 * recording it fails.
 */
export async function uploadMobileCaptureEvidence(
  fieldExecutiveId: string,
  componentId: string,
  metadata: MobileCaptureMetadata,
  file: EvidenceUploadFile | undefined,
): Promise<MobileEvidenceUploadResult> {
  if (!file) {
    throw new AppError(400, 'Attach the photo in the "file" part');
  }

  if (detectEvidenceMimeType(file.buffer) !== 'image/jpeg') {
    throw new AppError(415, 'The photo must be a JPEG image');
  }

  const capturedAt = toCapturedAt(metadata.capturedAt);
  await assertKnownPhotoType(metadata.documentTypeCode);

  const component = await findAssignedComponent(fieldExecutiveId, componentId);
  assertOpenForEvidence(component);

  const sha256 = sha256Hex(file.buffer);
  const existing = await caseEvidenceDao.findMobileCaptureBySha256(component.id, sha256);

  if (existing) {
    return replayed(existing, fieldExecutiveId, false);
  }

  const id = uuidv4();
  const row: NewMobileCaptureEvidenceRow = {
    id,
    component_id: component.id,
    field_executive_id: fieldExecutiveId,
    original_name: toDisplayName(file.originalName),
    storage_path: toStoragePath(component.id, id, 'image/jpeg'),
    mime_type: 'image/jpeg',
    size_bytes: file.buffer.length,
    sha256,
    document_type_code: metadata.documentTypeCode,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    accuracy_meters: metadata.accuracyMeters,
    is_mock_location: metadata.isMockLocation,
    captured_at: capturedAt,
  };

  let stored: MobileCaptureEvidenceRow;

  try {
    stored = await writeEvidenceFiles([{ storagePath: row.storage_path, buffer: file.buffer }], () =>
      caseEvidenceDao.insertMobileCaptureRow(row),
    );
  } catch (err) {
    // A concurrent retry of the same photo inserted first; this one's file is already removed.
    const winner =
      err instanceof DuplicateMobileCaptureError
        ? await caseEvidenceDao.findMobileCaptureBySha256(component.id, sha256)
        : undefined;

    if (!winner) {
      throw err;
    }
    return replayed(winner, fieldExecutiveId, true);
  }

  if (stored.is_mock_location) {
    // A modified client or a bug: the app refuses to capture under a mocked location.
    // Recorded rather than rejected, so the back office can see it. No coordinates logged.
    logger.warn(
      { fieldExecutiveId, componentId: component.id, evidenceId: stored.id },
      'Mobile evidence recorded with isMockLocation = true',
    );
  }

  logger.info(
    {
      fieldExecutiveId,
      componentId: component.id,
      evidenceId: stored.id,
      documentTypeCode: stored.document_type_code,
      sizeBytes: stored.size_bytes,
    },
    'Mobile evidence uploaded',
  );

  return { evidence: toMobileCaptureEvidence(stored), isNew: true };
}
