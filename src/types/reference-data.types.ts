export type DropdownCategory = 'verification_type_status' | 'utv_option' | 'insuff_option' | 'photo_type';

export interface DropdownOption {
  readonly code: string;
  readonly label: string;
}

export interface ReferenceData {
  readonly verificationTypeStatuses: DropdownOption[];
  readonly utvOptions: DropdownOption[];
  readonly insuffOptions: DropdownOption[];
  readonly photoTypes: DropdownOption[];
}

export interface DropdownOptionRow {
  readonly id: string;
  readonly category: DropdownCategory;
  readonly code: string;
  readonly label: string;
  readonly sort_order: number;
}
