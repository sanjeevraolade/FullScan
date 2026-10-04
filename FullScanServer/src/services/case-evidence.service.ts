import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  CaseEvidence,
  CaseEvidenceRow,
  EvidenceMimeType,
  MobileCaptureEvidence,
  MobileCaptureEvidenceRow,
  WebUploadEvidence,
  WebUploadEvidenceRow,
} from '../types/case-evidence.types.js';

/**
 * What every evidence path shares — the FE web upload, the mobile capture upload and
 * the evidence lists: file typing, naming, hashing, storage and the API shape.
 */

const FILE_EXTENSIONS: Readonly<Record<EvidenceMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_ORIGINAL_NAME_LENGTH = 255;

/** Buckets whose components still accept evidence. */
const EVIDENCE_OPEN_BUCKETS: ReadonlySet<CaseComponentRow['bucket']> = new Set(['pending', 'beyond_tat']);

export function canUploadEvidence(row: CaseComponentRow): boolean {
  return EVIDENCE_OPEN_BUCKETS.has(row.bucket);
}

/** Read at call time so tests (and deployments) can point it elsewhere. */
function getUploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

/**
 * Identifies the image type from its leading bytes. The client's `Content-Type`
 * and file extension are ignored — both are whatever the client was told.
 */
export function detectEvidenceMimeType(buffer: Buffer): EvidenceMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= pngSignature.length && pngSignature.every((byte, index) => buffer[index] === byte)) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/** Keeps a display name only: no path segments, no control characters, bounded length. */
export function toDisplayName(originalName: string): string {
  const baseName = originalName.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'evidence').slice(0, MAX_ORIGINAL_NAME_LENGTH);
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Where a file is kept, relative to `UPLOAD_DIR`: `evidence/<componentId>/<id>.<ext>`. Never exposed. */
export function toStoragePath(componentId: string, evidenceId: string, mimeType: EvidenceMimeType): string {
  return path.posix.join('evidence', componentId, `${evidenceId}.${FILE_EXTENSIONS[mimeType]}`);
}

export interface EvidenceFileToStore {
  /** Relative to `UPLOAD_DIR`, as `toStoragePath` builds it. */
  readonly storagePath: string;
  readonly buffer: Buffer;
}

/**
 * Writes `files` under `UPLOAD_DIR`, then runs `record` (which stores their rows).
 * All-or-nothing: if a write or `record` fails, every file already written is removed
 * and the error is rethrown. Files are created exclusively (`wx`), so an existing
 * file is never overwritten.
 */
export async function writeEvidenceFiles<T>(
  files: readonly EvidenceFileToStore[],
  record: () => Promise<T>,
): Promise<T> {
  const uploadRoot = getUploadRoot();
  const writtenPaths: string[] = [];

  try {
    for (const file of files) {
      const absolutePath = path.join(uploadRoot, file.storagePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.buffer, { flag: 'wx' });
      writtenPaths.push(absolutePath);
    }

    return await record();
  } catch (err) {
    for (const writtenPath of writtenPaths) {
      fs.rmSync(writtenPath, { force: true });
    }
    throw err;
  }
}

/** A mobile capture row → the API record. */
export function toMobileCaptureEvidence(row: MobileCaptureEvidenceRow): MobileCaptureEvidence {
  return {
    id: row.id,
    componentId: row.component_id,
    source: row.source,
    fileName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    documentTypeCode: row.document_type_code,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    isMockLocation: row.is_mock_location,
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
  };
}

function toWebUploadEvidence(row: WebUploadEvidenceRow): WebUploadEvidence {
  return {
    id: row.id,
    componentId: row.component_id,
    source: row.source,
    fileName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    documentTypeCode: null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    isMockLocation: null,
    capturedAt: null,
    uploadedAt: row.uploaded_at,
  };
}

/** A stored row → the API record, as every scope returns it. Web uploads carry null capture fields. */
export function toEvidence(row: CaseEvidenceRow): CaseEvidence {
  return row.source === 'mobile_capture' ? toMobileCaptureEvidence(row) : toWebUploadEvidence(row);
}
