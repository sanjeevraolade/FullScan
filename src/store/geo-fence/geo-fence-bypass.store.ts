import { create } from 'zustand';

import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';
import type { GeoFenceBypassConsent } from '@/domain/geo-fence';

const FILE_NAME = 'geo-fence-bypass.store.ts';

const STORAGE_KEY = 'geoFenceBypass:v1';

type ConsentsByCaseId = Readonly<Record<string, GeoFenceBypassConsent>>;

function readPersistedConsents(): ConsentsByCaseId {
  LoggerService.info(`${FILE_NAME}: readPersistedConsents: reading persisted bypass consents`);
  const persisted = KeyValueStorageService.getObject<ConsentsByCaseId>(STORAGE_KEY);
  if (!persisted) {
    LoggerService.info(`${FILE_NAME}: readPersistedConsents: nothing persisted yet`);
    return {};
  }
  LoggerService.info(`${FILE_NAME}: readPersistedConsents: persisted consents loaded`, {
    consentCount: Object.keys(persisted).length,
  });
  return persisted;
}

function persistConsents(consents: ConsentsByCaseId): void {
  LoggerService.info(`${FILE_NAME}: persistConsents: persisting bypass consents`, {
    consentCount: Object.keys(consents).length,
  });
  KeyValueStorageService.setObject(STORAGE_KEY, consents);
}

export interface GeoFenceBypassState {
  readonly consentsByCaseId: ConsentsByCaseId;
  grantConsent: (consent: GeoFenceBypassConsent) => void;
  revokeConsent: (caseId: string) => void;
  clearConsents: () => void;
}

/**
 * Records that a field executive explicitly chose to proceed with a case
 * without satisfying the geo-fence.
 *
 * Persisted rather than kept in memory for two reasons: leaving and returning
 * to Case Details (or the app being killed mid-visit) must not silently drop a
 * consent the user already gave, and the record is submitted with the
 * verification outcome so the back office can scrutinize the case. It is
 * per-case and never inferred — no consent exists unless the user tapped
 * "Agree".
 */
export const useGeoFenceBypassStore = create<GeoFenceBypassState>((set, get) => ({
  consentsByCaseId: readPersistedConsents(),

  grantConsent: (consent: GeoFenceBypassConsent): void => {
    LoggerService.warn(`${FILE_NAME}: grantConsent: geo-fence bypass consented`, {
      caseId: consent.caseId,
      attemptCount: consent.attemptCount,
      radiusMeters: consent.radiusMeters,
      lastDistanceMeters:
        consent.lastDistanceMeters === null ? null : Math.round(consent.lastDistanceMeters),
    });
    const consentsByCaseId = { ...get().consentsByCaseId, [consent.caseId]: consent };
    persistConsents(consentsByCaseId);
    set({ consentsByCaseId });
    LoggerService.info(`${FILE_NAME}: grantConsent: consent stored`, {
      caseId: consent.caseId,
      consentCount: Object.keys(consentsByCaseId).length,
    });
  },

  revokeConsent: (caseId: string): void => {
    LoggerService.info(`${FILE_NAME}: revokeConsent: clearing bypass consent`, { caseId });
    const { [caseId]: removed, ...remaining } = get().consentsByCaseId;
    if (!removed) {
      LoggerService.info(`${FILE_NAME}: revokeConsent: no consent recorded, nothing to clear`, {
        caseId,
      });
      return;
    }
    persistConsents(remaining);
    set({ consentsByCaseId: remaining });
    LoggerService.info(`${FILE_NAME}: revokeConsent: consent revoked`, {
      caseId,
      consentCount: Object.keys(remaining).length,
    });
  },

  clearConsents: (): void => {
    LoggerService.info(`${FILE_NAME}: clearConsents: clearing every bypass consent`, {
      consentCount: Object.keys(get().consentsByCaseId).length,
    });
    persistConsents({});
    set({ consentsByCaseId: {} });
    LoggerService.info(`${FILE_NAME}: clearConsents: every bypass consent cleared`);
  },
}));

/** Non-reactive read, for submission code outside React. */
export function getGeoFenceBypassConsent(caseId: string): GeoFenceBypassConsent | null {
  const consent = useGeoFenceBypassStore.getState().consentsByCaseId[caseId] ?? null;
  LoggerService.info(`${FILE_NAME}: getGeoFenceBypassConsent: reading consent`, {
    caseId,
    hasConsent: consent !== null,
  });
  return consent;
}
