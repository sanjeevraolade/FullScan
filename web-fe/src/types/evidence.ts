export type EvidenceMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export const EVIDENCE_MIME_TYPES: readonly EvidenceMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];

/** Mirrors the server's limits (src/middleware/evidence-upload.ts). The server stays the authority. */
export const MAX_EVIDENCE_FILES = 10;
export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

export interface Evidence {
  readonly id: string;
  readonly componentId: string;
  readonly source: 'web_upload';
  readonly fileName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
  readonly sha256: string;
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
