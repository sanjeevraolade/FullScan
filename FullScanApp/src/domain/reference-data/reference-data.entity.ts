/** One dropdown choice — `code` is the stable identifier to store/compare, `label` is display text only. */
export interface DropdownOption {
  readonly code: string;
  readonly label: string;
}

/** A mobile app setting's value, already coerced to its declared type by the backend. */
export type MobileAppSettingValue = boolean | number | string;

/**
 * Remote configuration administered from the Admin Portal's Mobile App Settings
 * page and delivered with the post-login reference-data payload.
 *
 * `values` is an open key/value map on purpose: a setting the back office adds
 * server-side arrives here without an app release. Use
 * `resolveMobileAppSettings` to read it as a typed, defaulted object rather
 * than indexing raw keys at call sites.
 */
export interface MobileAppSettings {
  readonly values: Readonly<Record<string, MobileAppSettingValue>>;
  /** Most recent change across all settings, or null if none has ever been edited. */
  readonly updatedAt: string | null;
}

/**
 * Every dropdown/option list the verification workflow needs, plus the
 * admin-managed mobile app settings, bundled into one payload loaded once at
 * login (see the product spec's login-time data fetch decision) rather than
 * per-case or per-screen. The payload is kept on the device, so a login whose
 * server version matches `updatedAt` reuses it instead of re-downloading.
 */
export interface ReferenceData {
  /**
   * The server's master-data version this payload belongs to, or null when the
   * server recorded none (or predates versioning). Opaque: only ever compared
   * for equality with the version `login()` reports, never parsed or ordered.
   */
  readonly updatedAt: string | null;
  readonly verificationTypeStatuses: readonly DropdownOption[];
  readonly utvOptions: readonly DropdownOption[];
  readonly insuffOptions: readonly DropdownOption[];
  readonly photoTypes: readonly DropdownOption[];
  /** Real-world per-component status labels (e.g. Insuff Raised, Verified Clear) — see `CaseDetail.componentStatus`. */
  readonly componentStatuses: readonly DropdownOption[];
  /** What the field executive/back office has done with a component (Uploaded, Accept/Approve, Stop). */
  readonly actionStatuses: readonly DropdownOption[];
  /** The whole case's aggregate report status (BGV Profile Created ... Final Report Generated). */
  readonly profileStatuses: readonly DropdownOption[];
  /** Admin-managed remote configuration — see `resolveMobileAppSettings`. */
  readonly mobileAppSettings: MobileAppSettings;
}
