export type EvidenceMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export const EVIDENCE_MIME_TYPES: readonly EvidenceMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];

/** Mirrors the server's limits (src/middleware/evidence-upload.ts). The server stays the authority. */
export const MAX_EVIDENCE_FILES = 10;
export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

/** `web_upload`: uploaded from a browser. `mobile_capture`: taken with the FullScan app's camera. */
export type EvidenceSource = 'web_upload' | 'mobile_capture';

export interface Evidence {
  readonly id: string;
  readonly componentId: string;
  readonly source: EvidenceSource;
  readonly fileName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
  readonly sha256: string;
  /** Capture metadata — set on mobile captures, null on web uploads. `documentTypeCode` is a `photo_type` code. */
  readonly documentTypeCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly isMockLocation: boolean | null;
  /** Device clock at capture, server timestamp format (UTC). */
  readonly capturedAt: string | null;
  readonly uploadedAt: string;
}

export interface EvidenceList {
  readonly componentId: string;
  readonly evidence: readonly Evidence[];
}

export interface UploadProgress {
  readonly loadedBytes: number;
  readonly totalBytes: number;
  /** 0–100. */
  readonly percent: number;
}
