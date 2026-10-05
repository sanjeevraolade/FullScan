import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';
import type { ResidenceType, AddressType } from '@/domain/case';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';
import type { GeoFenceBypassConsent } from '@/domain/geo-fence';

const FILE_NAME = 'draft-storage.ts';
const DRAFT_KEY_PREFIX = 'case_draft';

export interface CaseDraft {
  readonly caseId: string;
  readonly verificationStatus: string;
  readonly utvReason: string;
  readonly utvRemarks: string;
  readonly insufficientReason: string;
  readonly insufficientRemarks: string;
  /** Null while unanswered. Drafts saved before these could be blank always hold a value. */
  readonly residenceType: ResidenceType | null;
  readonly addressType: AddressType | null;
  readonly respondentName: string;
  readonly respondentRelation: string;
  readonly isSignatureCaptured: boolean;
  readonly selectedPhotoTag: string;
  /*
   * Kept in the JSON-safe navigation shape rather than the domain entity: a
   * draft round-trips through MMKV as JSON, which would turn a `Date` into a
   * string, and this is exactly the shape Case Details hands back to the
   * screen's navigation params on restore.
   */
  readonly capturedPhotos: readonly SerializedCapturedPhotoEvidence[];
  readonly geoFenceBypassConsent: GeoFenceBypassConsent | null;
  readonly savedAt: string;
}

/**
 * Manages case draft storage. Drafts are persisted locally so users can
 * resume incomplete case verification without losing their progress.
 */
export class DraftStorageService {
  private static getDraftKey(caseId: string): string {
    return `${DRAFT_KEY_PREFIX}:${caseId}`;
  }

  static saveDraft(draft: CaseDraft): void {
    const key = this.getDraftKey(draft.caseId);
    LoggerService.info(`${FILE_NAME}: saveDraft: saving case draft`, {
      caseId: draft.caseId,
      savedAtLength: draft.savedAt?.length ?? 0,
      photoCount: draft.capturedPhotos?.length ?? 0,
      hasBypassConsent: draft.geoFenceBypassConsent !== null,
    });
    try {
      KeyValueStorageService.setObject(key, draft);
      LoggerService.info(`${FILE_NAME}: saveDraft: draft saved successfully`, {
        caseId: draft.caseId,
      });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: saveDraft: failed to save draft`, {
        caseId: draft.caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  static loadDraft(caseId: string): CaseDraft | null {
    const key = this.getDraftKey(caseId);
    LoggerService.info(`${FILE_NAME}: loadDraft: loading case draft`, { caseId });
    try {
      const draft = KeyValueStorageService.getObject<CaseDraft>(key);
      if (draft === null) {
        LoggerService.info(`${FILE_NAME}: loadDraft: no draft found`, { caseId });
        return null;
      }
      LoggerService.info(`${FILE_NAME}: loadDraft: draft loaded`, {
        caseId,
        photoCount: draft.capturedPhotos?.length ?? 0,
        hasBypassConsent: draft.geoFenceBypassConsent !== null,
      });
      return draft;
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: loadDraft: failed to load draft`, {
        caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
      return null;
    }
  }

  static deleteDraft(caseId: string): void {
    const key = this.getDraftKey(caseId);
    LoggerService.info(`${FILE_NAME}: deleteDraft: deleting case draft`, { caseId });
    try {
      KeyValueStorageService.remove(key);
      LoggerService.info(`${FILE_NAME}: deleteDraft: draft deleted`, { caseId });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: deleteDraft: failed to delete draft`, {
        caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  static hasDraft(caseId: string): boolean {
    const key = this.getDraftKey(caseId);
    LoggerService.info(`${FILE_NAME}: hasDraft: checking for draft`, { caseId });
    try {
      const draft = KeyValueStorageService.getObject<CaseDraft>(key);
      const exists = draft !== null;
      LoggerService.info(`${FILE_NAME}: hasDraft: check result`, { caseId, exists });
      return exists;
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: hasDraft: failed to check draft`, {
        caseId,
        reason: error instanceof Error ? error.message : 'unknown error',
      });
      return false;
    }
  }

  static clearAllDrafts(): void {
    LoggerService.info(`${FILE_NAME}: clearAllDrafts: clearing all drafts`);
    try {
      const allKeys = KeyValueStorageService.getAllKeys();
      const draftKeys = allKeys.filter((k) => k.startsWith(DRAFT_KEY_PREFIX));
      draftKeys.forEach((k) => KeyValueStorageService.remove(k));
      LoggerService.info(`${FILE_NAME}: clearAllDrafts: all drafts cleared`, {
        count: draftKeys.length,
      });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: clearAllDrafts: failed to clear drafts`, {
        reason: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
