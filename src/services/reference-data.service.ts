import * as referenceDataDao from '../db/reference-data.dao.js';
import { getAllMobileAppSettings } from './mobile-app-setting.service.js';
import type {
  DropdownOption,
  DropdownOptionRow,
  MobileAppSettings,
  MobileAppSettingValue,
  ReferenceData,
} from '../types/reference-data.types.js';

function mapOptions(rows: DropdownOptionRow[]): DropdownOption[] {
  return rows.map((row) => ({ code: row.code, label: row.label }));
}

/**
 * Flattens the admin-managed settings into the key/value form the mobile app
 * consumes, dropping the portal-only presentation metadata (label, description,
 * min/max, options, updatedBy).
 *
 * Reuses the settings service rather than re-reading the DAO, so type coercion
 * happens in exactly one place.
 */
function buildMobileAppSettings(): MobileAppSettings {
  const settings = getAllMobileAppSettings();
  const values: Record<string, MobileAppSettingValue> = {};
  let updatedAt: string | null = null;

  for (const setting of settings) {
    values[setting.key] = setting.value;

    // SQLite's 'YYYY-MM-DD HH:MM:SS' sorts correctly as a string.
    if (setting.updatedAt && (!updatedAt || setting.updatedAt > updatedAt)) {
      updatedAt = setting.updatedAt;
    }
  }

  return { values, updatedAt };
}

/**
 * Bundles every dropdown/option list the verification workflow needs — plus the
 * admin-managed mobile app settings — into a single response. The app fetches
 * this once, right after login, rather than per-screen (see the product spec's
 * login-time data fetch decision).
 *
 * Settings ride along here instead of on a dedicated endpoint so the app keeps
 * using the one post-login batch call it already makes, and so re-fetching
 * reference data also refreshes configuration.
 */
export function getReferenceData(): ReferenceData {
  return {
    verificationTypeStatuses: mapOptions(referenceDataDao.findDropdownOptionsByCategory('verification_type_status')),
    utvOptions: mapOptions(referenceDataDao.findDropdownOptionsByCategory('utv_option')),
    insuffOptions: mapOptions(referenceDataDao.findDropdownOptionsByCategory('insuff_option')),
    photoTypes: mapOptions(referenceDataDao.findDropdownOptionsByCategory('photo_type')),
    componentStatuses: mapOptions(referenceDataDao.findDropdownOptionsByCategory('component_status')),
    actionStatuses: mapOptions(referenceDataDao.findDropdownOptionsByCategory('action_status')),
    profileStatuses: mapOptions(referenceDataDao.findDropdownOptionsByCategory('profile_status')),
    mobileAppSettings: buildMobileAppSettings(),
  };
}
