import { logger } from './logger.js';
import type { DeviceDetailsView } from '../types/device.types.js';

/** A non-empty string from untrusted JSON, or null. */
function readText(details: Record<string, unknown>, key: string): string | null {
  const value = details[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Parses stored `device_details` JSON (written from the mobile app's login payload)
 * into the fixed set of exposed fields. Defensive by design: unreadable details give
 * all-null fields rather than an error, so a binding is never hidden by bad data.
 *
 * `logContext` identifies the owner in the warning — never the content itself.
 */
export function parseDeviceDetails(
  deviceDetails: string | null | undefined,
  logContext: Record<string, unknown> = {},
): DeviceDetailsView {
  let details: Record<string, unknown> = {};

  if (deviceDetails) {
    try {
      const parsed: unknown = JSON.parse(deviceDetails);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        details = parsed as Record<string, unknown>;
      }
    } catch {
      logger.warn(logContext, 'Stored mobile device details are not valid JSON');
    }
  }

  return {
    deviceName: readText(details, 'deviceName'),
    brand: readText(details, 'brand'),
    model: readText(details, 'model'),
    systemName: readText(details, 'systemName'),
    osVersion: readText(details, 'osVersion'),
    appVersion: readText(details, 'appVersion'),
  };
}
