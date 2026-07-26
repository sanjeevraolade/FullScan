import type { ScreenDefinition } from '@/contracts';

/**
 * Real, but intentionally minimal: only the `required` validation type from
 * docs/06-Contracts/05-Validation-Schema.md is implemented. Pattern, Range,
 * GPS, GeoFence, MockLocation, Attachment and BusinessRule types are not —
 * there is nothing yet (no camera/GPS widgets, no business workflow) for
 * them to validate.
 */
export interface IValidationEngine {
  initialize(): void;
  dispose(): void;
  /** Returns a map of widgetId -> localization messageKey for every failed required field. */
  validateScreen(screen: ScreenDefinition, values: Readonly<Record<string, string>>): Record<string, string>;
}
