import * as referenceDataDao from '../db/reference-data.dao.js';
import type { DropdownOption, DropdownOptionRow, ReferenceData } from '../types/reference-data.types.js';

function mapOptions(rows: DropdownOptionRow[]): DropdownOption[] {
  return rows.map((row) => ({ code: row.code, label: row.label }));
}

/**
 * Bundles every dropdown/option list the verification workflow needs into a
 * single response — the app fetches this once, right after login, rather
 * than per-screen (see the product spec's login-time data fetch decision).
 */
export function getReferenceData(): ReferenceData {
  return {
    verificationTypeStatuses: mapOptions(referenceDataDao.findDropdownOptionsByCategory('verification_type_status')),
    utvOptions: mapOptions(referenceDataDao.findDropdownOptionsByCategory('utv_option')),
    insuffOptions: mapOptions(referenceDataDao.findDropdownOptionsByCategory('insuff_option')),
    photoTypes: mapOptions(referenceDataDao.findDropdownOptionsByCategory('photo_type')),
  };
}
