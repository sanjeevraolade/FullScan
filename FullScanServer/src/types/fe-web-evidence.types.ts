/** MIME types the web app may upload. Checked against the file's magic bytes, not the client's claim. */
export type EvidenceMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Row shape of `case_evidence`. */
export interface CaseEvidenceRow {
  readonly id: string;
  readonly component_id: string;
  readonly field_executive_id: string;
  readonly source: 'web_upload';
  readonly original_name: string;
  readonly storage_path: string;
  readonly mime_type: EvidenceMimeType;
  readonly size_bytes: number;
  readonly sha256: string;
  readonly uploaded_at: string;
}

/** One uploaded file as the web app sees it. The storage path is never exposed. */
export interface FeWebEvidence {
  readonly id: string;
  readonly componentId: string;
  readonly source: 'web_upload';
  readonly fileName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly uploadedAt: string;
}

export interface FeWebEvidenceList {
  readonly componentId: string;
  /** Newest first. */
  readonly evidence: readonly FeWebEvidence[];
}

/** An in-memory upload handed over by the multipart middleware. */
export interface EvidenceUploadFile {
  readonly originalName: string;
  readonly buffer: Buffer;
}

/** `case_evidence` joined with who uploaded it — the admin view. */
export interface CaseEvidenceWithUploaderRow extends CaseEvidenceRow {
  readonly field_executive_name: string;
  readonly field_executive_username: string;
}

/** Web evidence as the back office sees it: the FE view plus who uploaded it. */
export interface AdminCaseEvidence extends FeWebEvidence {
  readonly uploadedBy: { readonly id: string; readonly name: string; readonly username: string };
}

export interface AdminCaseEvidenceList {
  readonly caseId: string;
  /** Every component's web evidence, newest first. */
  readonly evidence: readonly AdminCaseEvidence[];
}
