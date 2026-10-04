/**
 * A single camera-captured, watermarked evidence photo, still local to the
 * device. It travels with the case (navigation params and the local draft)
 * until the field executive submits: Submit uploads each photo first — see
 * `UploadedCaseEvidence` for the server-side record it becomes — and only
 * then sends the verification outcome. Photos are deliberately not uploaded
 * at capture time, because server evidence can't be deleted and the
 * executive may still remove a photo before submitting.
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
