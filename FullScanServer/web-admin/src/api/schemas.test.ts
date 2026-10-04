import { describe, expect, it } from 'vitest';
import { caseEvidenceListSchema } from './schemas';

/** The admin evidence list carries web uploads and mobile captures (docs/api-contracts/mobile-evidence-upload.md). */

const uploadedBy = { id: 'fe-001', name: 'Field Exec', username: 'fe001' };

const webUpload = {
  id: 'w-1',
  componentId: 'case-0123-comp-1',
  source: 'web_upload',
  fileName: 'gate.jpg',
  mimeType: 'image/png',
  sizeBytes: 1024,
  sha256: 'aa',
  documentTypeCode: null,
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  isMockLocation: null,
  capturedAt: null,
  uploadedAt: '2026-10-04 09:20:11',
  uploadedBy,
};

const mobileCapture = {
  ...webUpload,
  id: 'm-1',
  source: 'mobile_capture',
  fileName: 'house_photo_1-1791105302123.jpg',
  mimeType: 'image/jpeg',
  documentTypeCode: 'house_photo_1',
  latitude: 17.4935,
  longitude: 78.3129,
  accuracyMeters: 8.5,
  isMockLocation: true,
  capturedAt: '2026-10-04 09:15:02',
};

describe('caseEvidenceListSchema', () => {
  it('accepts web uploads and mobile captures in one list', () => {
    const list = { caseId: 'case-0123', evidence: [mobileCapture, webUpload] };

    expect(caseEvidenceListSchema.parse(list)).toEqual(list);
  });

  it('rejects an unknown source', () => {
    expect(
      caseEvidenceListSchema.safeParse({ caseId: 'c', evidence: [{ ...webUpload, source: 'scanner' }] }).success,
    ).toBe(false);
  });
});
