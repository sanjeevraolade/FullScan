import type { BootstrapContext } from './BootstrapContext';

export type BootstrapResult =
  | { readonly success: true; readonly context: BootstrapContext }
  | { readonly success: false; readonly error: unknown; readonly failedStep: string };
