import type { IWidgetRegistry } from '@/contracts';

/**
 * Extends the shared IWidgetRegistry contract (used by widgets/renderer) with
 * the initialize()/dispose() lifecycle every Runtime Engine exposes.
 */
export interface IWidgetRegistryEngine extends IWidgetRegistry {
  initialize(): void;
  dispose(): void;
}
