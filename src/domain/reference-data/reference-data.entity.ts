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
  /** Real-world per-component status labels (e.g. Insuff Raised, Verified Clear) — see `CaseDetail.componentStatus`. */
  readonly componentStatuses: readonly DropdownOption[];
  /** What the field executive/back office has done with a component (Uploaded, Accept/Approve, Stop). */
  readonly actionStatuses: readonly DropdownOption[];
  /** The whole case's aggregate report status (BGV Profile Created ... Final Report Generated). */
  readonly profileStatuses: readonly DropdownOption[];
}
