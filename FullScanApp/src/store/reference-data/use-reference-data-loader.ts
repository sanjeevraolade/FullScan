import { useCallback, useState } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { fetchReferenceData } from '@/repositories/reference-data-repository';

import { useReferenceDataStore } from './reference-data.store';

const FILE_NAME = 'use-reference-data-loader.ts';

export interface UseReferenceDataLoaderResult {
  /** `true` once a reference-data payload (and therefore `mobileAppSettings`) is in the store. */
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly hasLoadFailed: boolean;
  /** Re-fetches the payload. Safe to call repeatedly — only one request is in flight at a time. */
  readonly reload: () => Promise<void>;
}

/**
 * Re-fetching the post-login reference-data payload (dropdowns +
 * `mobileAppSettings`) after a failure.
 *
 * Login already fetches it once; this exists so a screen that *cannot operate*
 * without server configuration — Case Details, which needs
 * `geo_fence_radius_meters` and `locationRetryCount` — can offer a retry
 * instead of silently falling back to a guessed radius.
 */
export function useReferenceDataLoader(): UseReferenceDataLoaderResult {
  const isLoaded = useReferenceDataStore((state) => state.referenceData !== null);
  const setReferenceData = useReferenceDataStore((state) => state.setReferenceData);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);

  LoggerService.info(`${FILE_NAME}: useReferenceDataLoader: rendering`, { isLoaded, isLoading });
  if (hasLoadFailed) {
    LoggerService.warn(`${FILE_NAME}: useReferenceDataLoader: the last load attempt failed`);
  }

  const reload = useCallback(async (): Promise<void> => {
    LoggerService.info(`${FILE_NAME}: reload: invoked`, { isLoading });
    if (isLoading) {
      LoggerService.info(`${FILE_NAME}: reload: already in flight, ignoring`);
      return;
    }

    LoggerService.info(`${FILE_NAME}: reload: fetching reference data`);
    setIsLoading(true);
    setHasLoadFailed(false);
    try {
      setReferenceData(await fetchReferenceData());
      LoggerService.info(`${FILE_NAME}: reload: reference data loaded`);
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: reload: reference data fetch failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
      setHasLoadFailed(true);
    } finally {
      LoggerService.info(`${FILE_NAME}: reload: finished, clearing the in-flight flag`);
      setIsLoading(false);
    }
  }, [isLoading, setReferenceData]);

  LoggerService.info(`${FILE_NAME}: useReferenceDataLoader: returning loader state`, {
    isLoaded,
    isLoading,
    hasLoadFailed,
  });

  return { isLoaded, isLoading, hasLoadFailed, reload };
}
