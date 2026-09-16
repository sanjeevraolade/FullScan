import type { AdminRole } from '../types/auth';
import type { CaseBucket, DropdownOption } from '../types/cases';
import type { DeviceChangeRequestStatus, DeviceReleaseReason } from '../types/device-change';

export const BUCKET_LABELS: Readonly<Record<CaseBucket, string>> = {
  new: 'New',
  pending: 'Pending',
  beyond_tat: 'Beyond TAT',
  completed: 'Completed',
};

export const ADDRESS_TYPE_LABELS: Readonly<Record<string, string>> = {
  present: 'Present',
  permanent: 'Permanent',
  previous: 'Previous',
};

export const RESIDENCE_TYPE_LABELS: Readonly<Record<string, string>> = {
  owned: 'Owned',
  rented: 'Rented',
  hostel: 'Hostel',
  paying_guest: 'Paying Guest',
  company_quarters: 'Company Quarters',
  relative_owned: 'Relative Owned',
};

export const ROLE_LABELS: Readonly<Record<AdminRole, string>> = {
  admin: 'Admin',
  super_admin: 'Super admin',
};

export const ROLE_ACCESS: Readonly<Record<AdminRole, string>> = {
  admin: 'Cases, Field Executive History, Device Change Requests and Add New Case.',
  super_admin: 'Everything an admin can do, plus Mobile App Settings and managing admins.',
};

export const REQUEST_STATUS_LABELS: Readonly<Record<DeviceChangeRequestStatus, string>> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const RELEASE_REASON_LABELS: Readonly<Record<DeviceReleaseReason, string>> = {
  device_change_approved: 'after an approved device change',
  binding_replaced: 'replaced by a new phone link',
};

/** Where in the app's lifecycle a mocked fix was noticed. */
export const DETECTION_STAGE_LABELS: Readonly<Record<string, string>> = {
  post_login: 'Right after login',
  app_resume: 'On app resume',
  manual_recheck: 'On a manual recheck',
  photo_capture: 'While capturing evidence',
};

export function isCaseBucket(value: string | null): value is CaseBucket {
  return value === 'new' || value === 'pending' || value === 'beyond_tat' || value === 'completed';
}

/** Resolves a reference-data code to its label; an unknown code falls back to itself. */
export function labelForCode(options: readonly DropdownOption[], code: string | null, fallback = '—'): string {
  if (!code) {
    return fallback;
  }
  return options.find((option) => option.code === code)?.label ?? code;
}

export function labelFor(labels: Readonly<Record<string, string>>, value: string | null, fallback = '—'): string {
  if (!value) {
    return fallback;
  }
  return labels[value] ?? value;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
