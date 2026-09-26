import * as referenceDataDao from '../db/reference-data.dao.js';
import { getAllMobileAppSettings } from './mobile-app-setting.service.js';
import type {
  DropdownCategory,
  DropdownOption,
  DropdownOptionRow,
  MobileAppSettings,
  MobileAppSettingValue,
  ReferenceData,
} from '../types/reference-data.types.js';

function mapOptions(rows: DropdownOptionRow[]): DropdownOption[] {
  return rows.map((row) => ({ code: row.code, label: row.label }));
}

async function findOptions(category: DropdownCategory): Promise<DropdownOption[]> {
  return mapOptions(await referenceDataDao.findDropdownOptionsByCategory(category));
}

/**
 * Flattens the admin-managed settings into the key/value form the mobile app
 * consumes, dropping the portal-only presentation metadata (label, description,
 * min/max, options, updatedBy).
 *
 * Reuses the settings service rather than re-reading the DAO, so type coercion
 * happens in exactly one place.
 */
async function buildMobileAppSettings(): Promise<MobileAppSettings> {
  const settings = await getAllMobileAppSettings();
  const values: Record<string, MobileAppSettingValue> = {};
  let updatedAt: string | null = null;

  for (const setting of settings) {
    values[setting.key] = setting.value;

    // The stored 'YYYY-MM-DD HH:MM:SS' sorts correctly as a string.
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
export async function getReferenceData(): Promise<ReferenceData> {
  const [
    verificationTypeStatuses,
    utvOptions,
    insuffOptions,
    photoTypes,
    componentStatuses,
    actionStatuses,
    profileStatuses,
    mobileAppSettings,
  ] = await Promise.all([
    findOptions('verification_type_status'),
    findOptions('utv_option'),
    findOptions('insuff_option'),
    findOptions('photo_type'),
    findOptions('component_status'),
    findOptions('action_status'),
    findOptions('profile_status'),
    buildMobileAppSettings(),
  ]);

  return {
    verificationTypeStatuses,
    utvOptions,
    insuffOptions,
    photoTypes,
    componentStatuses,
    actionStatuses,
    profileStatuses,
    mobileAppSettings,
  };
}
