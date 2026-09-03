export type DropdownCategory =
  | 'verification_type_status'
  | 'utv_option'
  | 'insuff_option'
  | 'photo_type'
  | 'component_status'
  | 'action_status'
  | 'profile_status';

export interface DropdownOption {
  readonly code: string;
  readonly label: string;
}

/** A mobile app setting's value, already coerced to the type its row declares. */
export type MobileAppSettingValue = boolean | number | string;

/**
 * Remote configuration the mobile app applies, as administered from the Admin
 * Portal's Mobile App Settings page.
 *
 * `values` is keyed by `mobile_app_settings.setting_key`, so a setting added as
 * a seed row reaches the app without a server or app release. The admin-facing
 * `label`/`description` text is deliberately **not** included: the mobile app
 * renders user-visible strings from its own localization keys (en/hi/te), never
 * from server-supplied English.
 */
export interface MobileAppSettings {
  readonly values: Readonly<Record<string, MobileAppSettingValue>>;
  /** Most recent change across all settings — lets the app tell whether config moved. */
  readonly updatedAt: string | null;
}

export interface ReferenceData {
  readonly verificationTypeStatuses: DropdownOption[];
  readonly utvOptions: DropdownOption[];
  readonly insuffOptions: DropdownOption[];
  readonly photoTypes: DropdownOption[];
  readonly componentStatuses: DropdownOption[];
  readonly actionStatuses: DropdownOption[];
  readonly profileStatuses: DropdownOption[];
  readonly mobileAppSettings: MobileAppSettings;
}

export interface DropdownOptionRow {
  readonly id: string;
  readonly category: DropdownCategory;
  readonly code: string;
  readonly label: string;
  readonly sort_order: number;
}
