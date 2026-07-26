import type { VerificationRuntimeEngine } from '@/runtime/engine';

/**
 * Shared, mutable state threaded through the Bootstrap Pipeline — each step
 * may read what earlier steps populated and write its own contribution.
 */
export interface BootstrapContext {
  runtimeEngine?: VerificationRuntimeEngine;
}
