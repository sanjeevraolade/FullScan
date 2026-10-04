/**
 * `case_evidence` — evidence files recorded against a case component, from either
 * the FE web portal (`web_upload`) or the mobile app's camera (`mobile_capture`).
 * Shared by the web, mobile and admin paths; see docs/api-contracts/mobile-evidence-upload.md.
 */

/** MIME types evidence may have. Checked against the file's magic bytes, not the client's claim. */
export type EvidenceMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export const EVIDENCE_SOURCES = ['web_upload', 'mobile_capture'] as const;

export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

interface CaseEvidenceBaseRow {
  readonly id: string;
  readonly component_id: string;
  readonly field_executive_id: string;
  readonly original_name: string;
  readonly storage_path: string;
  readonly mime_type: EvidenceMimeType;
  readonly size_bytes: number;
  readonly sha256: string;
  readonly uploaded_at: string;
}

/** A browser upload. Stored without the capture fields — they are absent (or null) on these rows. */
export interface WebUploadEvidenceRow extends CaseEvidenceBaseRow {
  readonly source: 'web_upload';
}

/** A photo taken with the app's camera, with the capture metadata the app recorded. */
export interface MobileCaptureEvidenceRow extends CaseEvidenceBaseRow {
  readonly source: 'mobile_capture';
  /** A `photo_type` master-data code. */
  readonly document_type_code: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy_meters: number;
  readonly is_mock_location: boolean;
  /** Device clock at capture, in the stored `YYYY-MM-DD HH:MM:SS` UTC format. */
  readonly captured_at: string;
}

/** Row shape of `case_evidence`. */
export type CaseEvidenceRow = WebUploadEvidenceRow | MobileCaptureEvidenceRow;

/** `case_evidence` joined with who uploaded it — the admin view. */
export type CaseEvidenceWithUploaderRow = CaseEvidenceRow & {
  readonly field_executive_name: string;
  readonly field_executive_username: string;
};

interface CaseEvidenceBase {
  readonly id: string;
  readonly componentId: string;
  readonly fileName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly uploadedAt: string;
}

/** A web upload as the API returns it: the capture fields are always null. */
export interface WebUploadEvidence extends CaseEvidenceBase {
  readonly source: 'web_upload';
  readonly documentTypeCode: null;
  readonly latitude: null;
  readonly longitude: null;
  readonly accuracyMeters: null;
  readonly isMockLocation: null;
  readonly capturedAt: null;
}

/** A mobile capture as the API returns it. */
export interface MobileCaptureEvidence extends CaseEvidenceBase {
  readonly source: 'mobile_capture';
  readonly documentTypeCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly isMockLocation: boolean;
  readonly capturedAt: string;
}

/** One evidence record as every API scope returns it. The storage path is never exposed. */
export type CaseEvidence = WebUploadEvidence | MobileCaptureEvidence;

/** An in-memory upload handed over by the multipart middleware. */
export interface EvidenceUploadFile {
  readonly originalName: string;
  readonly buffer: Buffer;
}

/** The text parts of a mobile capture upload, parsed (see `mobileEvidenceBodySchema`). */
export interface MobileCaptureMetadata {
  readonly documentTypeCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  /** ISO 8601 with an offset or `Z`, as the app sent it. */
  readonly capturedAt: string;
  readonly isMockLocation: boolean;
}

/** The mobile upload's outcome: `isNew` is false when the same bytes were already recorded (a replay). */
export interface MobileEvidenceUploadResult {
  readonly evidence: MobileCaptureEvidence;
  readonly isNew: boolean;
}
