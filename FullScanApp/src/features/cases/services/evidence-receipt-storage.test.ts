import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';

import { DraftStorageService } from './draft-storage';
import { EvidenceReceiptStorageService } from './evidence-receipt-storage';

const HOUSE_PHOTO_PATH = '/data/user/0/com.fullscan/cache/house-photo.jpg';
const DOOR_PHOTO_PATH = '/data/user/0/com.fullscan/cache/door-number.jpg';
const RECEIPT_KEY = 'case_evidence_receipts:case-1';

describe('EvidenceReceiptStorageService', () => {
  afterEach(() => {
    EvidenceReceiptStorageService.clearReceipts('case-1');
    EvidenceReceiptStorageService.clearReceipts('case-2');
    jest.restoreAllMocks();
  });

  it('has no receipts for a case nothing was uploaded for', () => {
    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({});
    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO_PATH)).toBeNull();
  });

  it('records the evidence id against the photo file path', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');

    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO_PATH)).toBe(
      'evidence-1',
    );
    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', DOOR_PHOTO_PATH)).toBeNull();
  });

  it('accumulates receipts across photos of the same case', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');
    EvidenceReceiptStorageService.markUploaded('case-1', DOOR_PHOTO_PATH, 'evidence-2');

    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
      [HOUSE_PHOTO_PATH]: 'evidence-1',
      [DOOR_PHOTO_PATH]: 'evidence-2',
    });
  });

  it('persists receipts in MMKV, so they survive an app restart', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');

    // Read straight from storage — nothing is held in memory by the service.
    expect(KeyValueStorageService.getObject<unknown>(RECEIPT_KEY)).toEqual({
      [HOUSE_PHOTO_PATH]: 'evidence-1',
    });
  });

  it('keeps each case’s receipts separate', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');

    expect(EvidenceReceiptStorageService.getEvidenceId('case-2', HOUSE_PHOTO_PATH)).toBeNull();
  });

  it('clears only the given case’s receipts', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');
    EvidenceReceiptStorageService.markUploaded('case-2', HOUSE_PHOTO_PATH, 'evidence-9');

    EvidenceReceiptStorageService.clearReceipts('case-1');

    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({});
    expect(EvidenceReceiptStorageService.getEvidenceId('case-2', HOUSE_PHOTO_PATH)).toBe(
      'evidence-9',
    );
  });

  it('is not swept away by clearing every draft', () => {
    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');

    DraftStorageService.clearAllDrafts();

    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO_PATH)).toBe(
      'evidence-1',
    );
  });

  it('treats a stored value that is not a receipt map as no receipts', () => {
    KeyValueStorageService.setObject(RECEIPT_KEY, ['evidence-1']);

    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({});
  });

  it('drops malformed entries but keeps the valid ones', () => {
    KeyValueStorageService.setObject(RECEIPT_KEY, {
      [HOUSE_PHOTO_PATH]: 'evidence-1',
      [DOOR_PHOTO_PATH]: 42,
      '/data/empty-id.jpg': '',
    });

    expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
      [HOUSE_PHOTO_PATH]: 'evidence-1',
    });
  });

  it('swallows a storage write failure — the photo is simply sent again next time', () => {
    jest.spyOn(KeyValueStorageService, 'setObject').mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() =>
      EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1'),
    ).not.toThrow();
    expect(EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO_PATH)).toBeNull();
  });

  it('never logs a photo file path', () => {
    const infoSpy = jest.spyOn(LoggerService, 'info');
    const warnSpy = jest.spyOn(LoggerService, 'warn');
    const errorSpy = jest.spyOn(LoggerService, 'error');

    EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO_PATH, 'evidence-1');
    EvidenceReceiptStorageService.getEvidenceId('case-1', HOUSE_PHOTO_PATH);
    EvidenceReceiptStorageService.clearReceipts('case-1');

    const loggedText = JSON.stringify([
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(loggedText).toContain('evidence-1');
    expect(loggedText).not.toContain('house-photo');
  });
});
