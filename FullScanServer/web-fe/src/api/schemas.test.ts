import { describe, expect, it } from 'vitest';
import { evidenceListSchema } from './schemas';

/** The server's evidence list carries web uploads and mobile captures (docs/api-contracts/mobile-evidence-upload.md). */

const webUpload = {
  id: 'w-1',
  componentId: 'case-0123-comp-1',
  source: 'web_upload',
  fileName: 'door.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  sha256: 'aa',
  documentTypeCode: null,
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  isMockLocation: null,
  capturedAt: null,
  uploadedAt: '2026-10-04 09:20:11',
};

const mobileCapture = {
  ...webUpload,
  id: 'm-1',
  source: 'mobile_capture',
  fileName: 'house_photo_1-1791105302123.jpg',
  documentTypeCode: 'house_photo_1',
  latitude: 17.4935,
  longitude: 78.3129,
  accuracyMeters: 8.5,
  isMockLocation: false,
  capturedAt: '2026-10-04 09:15:02',
};

describe('evidenceListSchema', () => {
  it('accepts web uploads and mobile captures in one list', () => {
    const list = { componentId: 'case-0123-comp-1', evidence: [mobileCapture, webUpload] };

    expect(evidenceListSchema.parse(list)).toEqual(list);
  });

  it('rejects an unknown source', () => {
    expect(
      evidenceListSchema.safeParse({ componentId: 'c', evidence: [{ ...webUpload, source: 'scanner' }] }).success,
    ).toBe(false);
  });
});
