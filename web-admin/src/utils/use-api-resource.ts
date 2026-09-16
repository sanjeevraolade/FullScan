import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError, toErrorMessage } from '../api/client';
import type { LoadStatus } from '../types/api';

export interface ApiResource<TData> {
  readonly data: TData | null;
  readonly status: LoadStatus;
  readonly error: string | null;
  /** Re-runs the loader; the current data stays visible while it runs. */
  readonly reload: () => Promise<void>;
  /** Replaces the data locally, e.g. with a save response. */
  readonly setData: (data: TData) => void;
}

/**
 * Page-local server data: loads when `deps` change, cancels the previous request,
 * and ignores a 401 (the session handler has already signed the app out).
 * Pass `isEnabled: false` to hold off (e.g. until something is selected).
 */
export function useApiResource<TData>(
  load: (signal: AbortSignal) => Promise<TData>,
  deps: readonly unknown[],
  { isEnabled = true, fallbackError = 'Could not load this page.' }: { isEnabled?: boolean; fallbackError?: string } = {},
): ApiResource<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setError(null);

    try {
      const result = await loadRef.current(controller.signal);
      if (!controller.signal.aborted) {
        setData(result);
        setStatus('success');
      }
    } catch (caught) {
      if (isAbortError(caught) || controller.signal.aborted || (caught instanceof ApiError && caught.isUnauthorized)) {
        return;
      }
      setStatus('error');
      setError(toErrorMessage(caught, fallbackError));
    }
  }, [fallbackError]);

  useEffect(() => {
    if (!isEnabled) {
      controllerRef.current?.abort();
      setData(null);
      setStatus('idle');
      setError(null);
      return;
    }
    void run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, run, ...deps]);

  return { data, status, error, reload: run, setData };
}
