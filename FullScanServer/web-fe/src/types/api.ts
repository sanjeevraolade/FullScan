/** Every FullScanServer response uses this envelope. */
export type ApiEnvelope<TData> =
  | { readonly success: true; readonly data: TData }
  | { readonly success: false; readonly error: string; readonly details?: readonly ApiValidationIssue[] };

export interface ApiValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';
