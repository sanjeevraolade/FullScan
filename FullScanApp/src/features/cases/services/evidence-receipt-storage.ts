import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';

const FILE_NAME = 'evidence-receipt-storage.ts';
/*
 * Deliberately not prefixed `case_draft`: `DraftStorageService.clearAllDrafts`
 * removes every key starting with that, and receipts must outlive a draft.
 */
const RECEIPT_KEY_PREFIX = 'case_evidence_receipts';

/** A case's upload receipts: local photo file path → server evidence id. */
export type EvidenceUploadReceipts = Readonly<Record<string, string>>;

const NO_RECEIPTS: EvidenceUploadReceipts = {};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  LoggerService.info(`${FILE_NAME}: isPlainRecord: stored value shape checked`, { isRecord });
  return isRecord;
}

/**
 * Keeps only well-formed entries of a stored value. MMKV hands back whatever
 * JSON was there, so a corrupt or older-format entry degrades to "not
 * uploaded" — the safe direction, since the server returns the existing
 * record for a re-sent photo.
 */
function toValidReceipts(stored: unknown): EvidenceUploadReceipts {
  if (!isPlainRecord(stored)) {
    LoggerService.warn(`${FILE_NAME}: toValidReceipts: stored receipts unusable — ignored`);
    return NO_RECEIPTS;
  }
  const entries = Object.entries(stored);
  const validEntries = entries.filter(
    (entry): entry is [string, string] =>
      entry[0].length > 0 && typeof entry[1] === 'string' && entry[1].length > 0,
  );
  LoggerService.info(`${FILE_NAME}: toValidReceipts: stored receipts read`, {
    storedCount: entries.length,
    validCount: validEntries.length,
  });
  return Object.fromEntries(validEntries);
}

/**
 * Persists which captured photos of a case the server already holds, so a
 * Submit retry — even after an app restart — only uploads what is left.
 * Receipts are keyed by the local file path (never logged) and are cleared
 * when the case's outcome submission succeeds.
 *
 * Write failures are logged and swallowed: a lost receipt only means that
 * photo is sent again, and the server answers a re-sent photo with the
 * record it already has.
 */
export class EvidenceReceiptStorageService {
  private static getReceiptKey(caseId: string): string {
    return `${RECEIPT_KEY_PREFIX}:${caseId}`;
  }

  static getReceipts(caseId: string): EvidenceUploadReceipts {
    LoggerService.info(`${FILE_NAME}: getReceipts: loading upload receipts`, { caseId });
    try {
      const stored = KeyValueStorageService.getObject<unknown>(this.getReceiptKey(caseId));
      if (stored === null) {
        LoggerService.info(`${FILE_NAME}: getReceipts: no receipts for case`, { caseId });
        return NO_RECEIPTS;
      }
      const receipts = toValidReceipts(stored);
      LoggerService.info(`${FILE_NAME}: getReceipts: receipts loaded`, {
        caseId,
        count: Object.keys(receipts).length,
      });
      return receipts;
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: getReceipts: failed to load receipts`, {
        caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
      return NO_RECEIPTS;
    }
  }

  /** The server evidence id recorded for this photo, or `null` if it hasn't been uploaded. */
  static getEvidenceId(caseId: string, filePath: string): string | null {
    LoggerService.info(`${FILE_NAME}: getEvidenceId: looking up receipt`, { caseId });
    const evidenceId = this.getReceipts(caseId)[filePath] ?? null;
    LoggerService.info(`${FILE_NAME}: getEvidenceId: lookup result`, {
      caseId,
      hasReceipt: evidenceId !== null,
    });
    return evidenceId;
  }

  static markUploaded(caseId: string, filePath: string, evidenceId: string): void {
    LoggerService.info(`${FILE_NAME}: markUploaded: recording upload receipt`, {
      caseId,
      evidenceId,
    });
    try {
      const receipts: EvidenceUploadReceipts = {
        ...this.getReceipts(caseId),
        [filePath]: evidenceId,
      };
      KeyValueStorageService.setObject(this.getReceiptKey(caseId), receipts);
      LoggerService.info(`${FILE_NAME}: markUploaded: receipt recorded`, {
        caseId,
        evidenceId,
        count: Object.keys(receipts).length,
      });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: markUploaded: failed to record receipt`, {
        caseId,
        evidenceId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  static clearReceipts(caseId: string): void {
    LoggerService.info(`${FILE_NAME}: clearReceipts: clearing upload receipts`, { caseId });
    try {
      KeyValueStorageService.remove(this.getReceiptKey(caseId));
      LoggerService.info(`${FILE_NAME}: clearReceipts: receipts cleared`, { caseId });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: clearReceipts: failed to clear receipts`, {
        caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
