import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';
import type { MobileAppSettingValue, ReferenceData } from '@/domain/reference-data';

const FILE_NAME = 'reference-data-repository.ts';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

interface DropdownOptionDto {
  readonly code: string;
  readonly label: string;
}

interface MobileAppSettingsDto {
  readonly values: Readonly<Record<string, MobileAppSettingValue>>;
  readonly updatedAt: string | null;
}

/** `GET /master-data`'s `data`. */
interface MasterDataDto {
  /** Absent from a server that predates master-data versioning. */
  readonly updatedAt?: string | null;
  readonly verificationTypeStatuses: readonly DropdownOptionDto[];
  readonly utvOptions: readonly DropdownOptionDto[];
  readonly insuffOptions: readonly DropdownOptionDto[];
  readonly photoTypes: readonly DropdownOptionDto[];
  readonly componentStatuses: readonly DropdownOptionDto[];
  readonly actionStatuses: readonly DropdownOptionDto[];
  readonly profileStatuses: readonly DropdownOptionDto[];
  readonly mobileAppSettings: MobileAppSettingsDto;
}

/**
 * Server endpoint for the reference-data payload. The server calls it "master
 * data"; every layer above this repository keeps the `ReferenceData` name, so
 * the rename stops here.
 */
const MASTER_DATA_PATH = '/master-data';

/**
 * MMKV key for the last downloaded payload. `v1` is the app's cache-schema
 * version, not the server's data version: bump it whenever the `ReferenceData`
 * shape changes, so an upgraded build never reads a payload shaped for the
 * previous one. MMKV rather than Keychain because nothing in it is sensitive —
 * option labels and settings, no PII.
 */
const REFERENCE_DATA_CACHE_KEY = 'master-data:v1';

const OPTION_LIST_FIELDS: readonly (keyof ReferenceData)[] = [
  'verificationTypeStatuses',
  'utvOptions',
  'insuffOptions',
  'photoTypes',
  'componentStatuses',
  'actionStatuses',
  'profileStatuses',
];

/**
 * Fields are copied explicitly so the cache holds exactly a `ReferenceData` —
 * the shape the cache key's `v1` describes — rather than whatever extra fields
 * a newer server adds.
 */
function mapReferenceData(dto: MasterDataDto): ReferenceData {
  LoggerService.info(`${FILE_NAME}: mapReferenceData: mapping master-data payload`, {
    hasUpdatedAt: dto.updatedAt !== undefined,
  });
  return {
    updatedAt: dto.updatedAt ?? null,
    verificationTypeStatuses: dto.verificationTypeStatuses,
    utvOptions: dto.utvOptions,
    insuffOptions: dto.insuffOptions,
    photoTypes: dto.photoTypes,
    componentStatuses: dto.componentStatuses,
    actionStatuses: dto.actionStatuses,
    profileStatuses: dto.profileStatuses,
    mobileAppSettings: {
      values: dto.mobileAppSettings.values,
      updatedAt: dto.mobileAppSettings.updatedAt,
    },
  };
}

/**
 * A parseable entry of the wrong shape would otherwise be handed to the store
 * on every login whose version matches it — and fail each one — until the
 * server's version next changes. Checks structure only, not each option.
 */
function isReferenceDataShape(value: unknown): value is ReferenceData {
  LoggerService.info(`${FILE_NAME}: isReferenceDataShape: checking cached entry structure`);
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  const updatedAt = fields.get('updatedAt');
  const mobileAppSettings = fields.get('mobileAppSettings');
  return (
    (typeof updatedAt === 'string' || updatedAt === null) &&
    OPTION_LIST_FIELDS.every((field) => Array.isArray(fields.get(field))) &&
    typeof mobileAppSettings === 'object' &&
    mobileAppSettings !== null &&
    'values' in mobileAppSettings &&
    typeof mobileAppSettings.values === 'object' &&
    mobileAppSettings.values !== null
  );
}

/** The persisted payload, or null when there is none or it can't be used. */
function readCachedReferenceData(): ReferenceData | null {
  // `getObject` already treats an unparseable entry as missing (and drops it).
  const cached = KeyValueStorageService.getObject<unknown>(REFERENCE_DATA_CACHE_KEY);
  if (cached === null) {
    LoggerService.info(`${FILE_NAME}: readCachedReferenceData: nothing cached`);
    return null;
  }
  if (!isReferenceDataShape(cached)) {
    // Left in place: the fetch that follows overwrites it on success, and a
    // failed fetch must leave the cache untouched.
    LoggerService.warn(
      `${FILE_NAME}: readCachedReferenceData: cached entry has an unexpected shape, ignoring it`,
    );
    return null;
  }
  LoggerService.info(`${FILE_NAME}: readCachedReferenceData: cached payload found`, {
    cachedUpdatedAt: cached.updatedAt,
  });
  return cached;
}

function persistReferenceData(referenceData: ReferenceData): void {
  LoggerService.info(`${FILE_NAME}: persistReferenceData: caching payload`, {
    updatedAt: referenceData.updatedAt,
  });
  try {
    KeyValueStorageService.setObject(REFERENCE_DATA_CACHE_KEY, referenceData);
  } catch (error: unknown) {
    // The cache only saves a future request — failing to write it must never
    // fail a login that already has the data. The next login just fetches.
    LoggerService.error(`${FILE_NAME}: persistReferenceData: could not cache payload`, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Bulk dropdown/option data (statuses, UTV/Insufficient reasons, photo types)
 * plus `mobileAppSettings`, always downloaded from `GET /master-data` and then
 * persisted so a later login can reuse it. Login goes through
 * `loadReferenceData` instead, which skips this request when nothing changed.
 * Rejects with the underlying request error; nothing is persisted on failure.
 */
export async function fetchReferenceData(): Promise<ReferenceData> {
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: requesting reference data`, {
    path: MASTER_DATA_PATH,
  });
  const response = await apiClient.get<ApiEnvelope<MasterDataDto>>(MASTER_DATA_PATH);
  const referenceData = mapReferenceData(response.data.data);
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: received reference data`);
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: option counts`, {
    success: response.data.success,
    updatedAt: referenceData.updatedAt,
    verificationTypeStatusCount: referenceData.verificationTypeStatuses.length,
    utvOptionCount: referenceData.utvOptions.length,
    insuffOptionCount: referenceData.insuffOptions.length,
    photoTypeCount: referenceData.photoTypes.length,
    componentStatusCount: referenceData.componentStatuses.length,
    actionStatusCount: referenceData.actionStatuses.length,
    profileStatusCount: referenceData.profileStatuses.length,
    hasMobileAppSettings: referenceData.mobileAppSettings != null,
  });
  persistReferenceData(referenceData);
  return referenceData;
}

/**
 * The post-login load: the persisted payload when `serverUpdatedAt` (the
 * `masterDataUpdatedAt` from `login()`) equals the version stored with it,
 * otherwise `fetchReferenceData()`.
 *
 * A failed fetch rejects — there is deliberately no fallback to a stale cached
 * copy, because out-of-date geo-fence settings must not decide access — and
 * leaves the existing cache entry as it was.
 */
export async function loadReferenceData(serverUpdatedAt: string | null): Promise<ReferenceData> {
  LoggerService.info(`${FILE_NAME}: loadReferenceData: choosing cache or network`, {
    serverUpdatedAt,
  });

  if (serverUpdatedAt === null) {
    // An unknown server version can't prove any cached copy current.
    LoggerService.info(`${FILE_NAME}: loadReferenceData: cache miss, fetching`, {
      isCacheHit: false,
      reason: 'noServerVersion',
      serverUpdatedAt,
    });
    return fetchReferenceData();
  }

  const cached = readCachedReferenceData();
  if (cached === null) {
    LoggerService.info(`${FILE_NAME}: loadReferenceData: cache miss, fetching`, {
      isCacheHit: false,
      reason: 'noCache',
      serverUpdatedAt,
      cachedUpdatedAt: null,
    });
    return fetchReferenceData();
  }

  // Equality only, never ordering: the version is opaque, and a server value
  // *older* than the cached one (clock correction, database restore) still
  // means the cached copy may not be what the server serves now.
  if (cached.updatedAt !== serverUpdatedAt) {
    LoggerService.info(`${FILE_NAME}: loadReferenceData: cache miss, fetching`, {
      isCacheHit: false,
      reason: 'versionDiffers',
      serverUpdatedAt,
      cachedUpdatedAt: cached.updatedAt,
    });
    return fetchReferenceData();
  }

  LoggerService.info(`${FILE_NAME}: loadReferenceData: cache hit, skipping the request`, {
    isCacheHit: true,
    serverUpdatedAt,
    cachedUpdatedAt: cached.updatedAt,
  });
  return cached;
}
