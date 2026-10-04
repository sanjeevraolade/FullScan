import * as caseEvidenceRepository from '@/repositories/case-evidence-repository';
import { CaseEvidenceUploadError } from '@/repositories/case-evidence-repository.errors';
import type { CapturedPhotoEvidence, UploadedCaseEvidence } from '@/domain/case';

import { uploadPendingCaseEvidence } from './case-evidence-uploader';
import type { EvidenceUploadProgress } from './case-evidence-uploader';
import { EvidenceReceiptStorageService } from './evidence-receipt-storage';

jest.mock('@/repositories/case-evidence-repository');

function buildPhoto(name: string, documentTypeCode: string): CapturedPhotoEvidence {
  return {
    filePath: `/data/user/0/com.fullscan/cache/${name}.jpg`,
    latitude: 17.4935,
    longitude: 78.3129,
    accuracyMeters: 8.5,
    isMockLocation: false,
    capturedAt: new Date('2026-10-04T09:15:02.123Z'),
    documentTypeCode,
  };
}

const HOUSE_PHOTO = buildPhoto('house', 'house_photo_1');
const DOOR_PHOTO = buildPhoto('door', 'door_number');
const STREET_PHOTO = buildPhoto('street', 'street_view');

function buildEvidence(id: string, documentTypeCode: string): UploadedCaseEvidence {
  return {
    id,
    caseId: 'case-1',
    fileName: `${documentTypeCode}-1791105302123.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 482113,
    sha256: `sha-${id}`,
    documentTypeCode,
    latitude: 17.4935,
    longitude: 78.3129,
    accuracyMeters: 8.5,
    isMockLocation: false,
    capturedAt: new Date('2026-10-04T09:15:02.000Z'),
    uploadedAt: new Date('2026-10-04T09:20:11.000Z'),
    wasAlreadyUploaded: false,
  };
}

/** Each upload succeeds with an id derived from the photo's tag. */
function mockSuccessfulUploads(): void {
  jest
    .mocked(caseEvidenceRepository.uploadCaseEvidence)
    .mockImplementation(async (_caseId, photo) =>
      buildEvidence(`evidence-${photo.documentTypeCode}`, photo.documentTypeCode),
    );
}

function uploadedDocumentTypeCodes(): string[] {
  return jest
    .mocked(caseEvidenceRepository.uploadCaseEvidence)
    .mock.calls.map(([, photo]) => photo.documentTypeCode);
}

describe('uploadPendingCaseEvidence', () => {
  afterEach(() => {
    jest.clearAllMocks();
    EvidenceReceiptStorageService.clearReceipts('case-1');
  });

  it('uploads every photo in capture order and records a receipt for each', async () => {
    mockSuccessfulUploads();
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO, DOOR_PHOTO, STREET_PHOTO], onProgress);

    expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1', 'door_number', 'street_view']);
    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
      [HOUSE_PHOTO.filePath]: 'evidence-house_photo_1',
      [DOOR_PHOTO.filePath]: 'evidence-door_number',
      [STREET_PHOTO.filePath]: 'evidence-street_view',
    });
  });

  it('reports progress before the first upload and after every success', async () => {
    mockSuccessfulUploads();
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO, DOOR_PHOTO], onProgress);

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { uploadedCount: 0, totalCount: 2 },
      { uploadedCount: 1, totalCount: 2 },
      { uploadedCount: 2, totalCount: 2 },
    ]);
  });

  it('only uploads photos without a receipt, counting the receipted ones as done', async () => {
    mockSuccessfulUploads();
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO.filePath, 'evidence-earlier');
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO, DOOR_PHOTO], onProgress);

    expect(uploadedDocumentTypeCodes()).toEqual(['door_number']);
    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { uploadedCount: 1, totalCount: 2 },
      { uploadedCount: 2, totalCount: 2 },
    ]);
    // An existing receipt is never overwritten.
    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO.filePath)).toBe(
      'evidence-earlier',
    );
  });

  it('sends nothing and reports no progress when every photo is already uploaded', async () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO.filePath, 'evidence-1');
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO], onProgress);

    expect(caseEvidenceRepository.uploadCaseEvidence).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('sends nothing for a case with no photos', async () => {
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [], onProgress);

    expect(caseEvidenceRepository.uploadCaseEvidence).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('uploads a photo listed twice only once', async () => {
    mockSuccessfulUploads();
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO, HOUSE_PHOTO], onProgress);

    expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1']);
    expect(onProgress).toHaveBeenLastCalledWith({ uploadedCount: 1, totalCount: 1 });
  });

  it('stops at the first failure, keeping the receipts of the photos before it', async () => {
    const failure = new CaseEvidenceUploadError('network');
    jest
      .mocked(caseEvidenceRepository.uploadCaseEvidence)
      .mockResolvedValueOnce(buildEvidence('evidence-1', 'house_photo_1'))
      .mockRejectedValueOnce(failure);
    const onProgress = jest.fn<void, [EvidenceUploadProgress]>();

    await expect(
      uploadPendingCaseEvidence('case-1', [HOUSE_PHOTO, DOOR_PHOTO, STREET_PHOTO], onProgress),
    ).rejects.toBe(failure);

    // The third photo is never attempted.
    expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1', 'door_number']);
    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
      [HOUSE_PHOTO.filePath]: 'evidence-1',
    });
    expect(onProgress).toHaveBeenLastCalledWith({ uploadedCount: 1, totalCount: 3 });
  });
});
