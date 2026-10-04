/**
 * A captured photo as the server holds it once the upload has been accepted.
 * Evidence is immutable on the server — there is no update or delete — so
 * this is the permanent back-office record of the photo, not a draft.
 */
export interface UploadedCaseEvidence {
  /** Server evidence id — what an upload receipt records against the local photo. */
  readonly id: string;
  /** The case component the evidence is attached to. */
  readonly caseId: string;
  /** Sanitized display name the server kept; never a storage path. */
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** SHA-256 of the uploaded bytes — the server's idempotency key for retries. */
  readonly sha256: string;
  /** A `ReferenceData.photoTypes` code — which document tag the photo was captured for. */
  readonly documentTypeCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly isMockLocation: boolean;
  /** The device clock at capture, as the server stored it. */
  readonly capturedAt: Date;
  /** The server clock when the evidence was first stored. */
  readonly uploadedAt: Date;
  /**
   * True when the server already held these exact bytes and returned the
   * existing record instead of storing a new one — a retry after a lost
   * response. Either way the photo counts as uploaded.
   */
  readonly wasAlreadyUploaded: boolean;
}
