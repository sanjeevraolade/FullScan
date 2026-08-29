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

export interface ReferenceData {
  readonly verificationTypeStatuses: DropdownOption[];
  readonly utvOptions: DropdownOption[];
  readonly insuffOptions: DropdownOption[];
  readonly photoTypes: DropdownOption[];
  readonly componentStatuses: DropdownOption[];
  readonly actionStatuses: DropdownOption[];
  readonly profileStatuses: DropdownOption[];
}

export interface DropdownOptionRow {
  readonly id: string;
  readonly category: DropdownCategory;
  readonly code: string;
  readonly label: string;
  readonly sort_order: number;
}
