/** One dropdown choice — `code` is the stable identifier to store/compare, `label` is display text only. */
export interface DropdownOption {
  readonly code: string;
  readonly label: string;
}

/**
 * Every dropdown/option list the verification workflow needs, bundled into
 * one payload fetched once right after login (see the product spec's
 * login-time data fetch decision) rather than per-case or per-screen.
 */
export interface ReferenceData {
  readonly verificationTypeStatuses: readonly DropdownOption[];
  readonly utvOptions: readonly DropdownOption[];
  readonly insuffOptions: readonly DropdownOption[];
  readonly photoTypes: readonly DropdownOption[];
}
