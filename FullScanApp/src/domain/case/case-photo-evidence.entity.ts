/**
 * A single camera-captured, watermarked evidence photo, still local to the
 * device. Attachment persistence and upload (Synchronization Engine) aren't
 * built yet — this is the in-memory shape the camera hands back to the
 * verification form.
 */
export interface CapturedPhotoEvidence {
  /** Filesystem path of the final, watermark-burned JPEG. Not a `file://` URL. */
  readonly filePath: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly isMockLocation: boolean;
  readonly capturedAt: Date;
  /** A `ReferenceData.photoTypes` code — which document tag this photo was captured for. */
  readonly documentTypeCode: string;
}
