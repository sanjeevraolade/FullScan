/**
 * Generic, declarative form validation. A form's rules are a list of
 * sections; each section says *when* it applies and which fields it requires,
 * so a new mandatory section is a new entry in that list — no new plumbing.
 *
 * Results only ever carry localization keys, never resolved text: the screen
 * resolves them at render time, so a shown error follows a language switch.
 */

/** One check on a single field's value, e.g. "required". */
export interface FieldValidator<TValue> {
  /** Stable, discoverable identifier of the check (`required`, `minLength`, ...). */
  readonly ruleId: string;
  readonly messageKey: string;
  readonly isSatisfiedBy: (value: TValue) => boolean;
  /**
   * Whether this check means the field must be filled in (e.g. `required`, or
   * "at least one photo") — such fields are marked with "*" on the form.
   */
  readonly isRequirement?: boolean;
}

/** The checks a section runs per field, in order; the first failing one is reported. */
export type FieldValidators<TValues> = {
  readonly [TField in keyof TValues]?: readonly FieldValidator<TValues[TField]>[];
};

/** A rule about the form as a whole (e.g. "something must be entered") rather than one field. */
export interface FormCheck<TValues> {
  readonly ruleId: string;
  readonly messageKey: string;
  readonly isSatisfiedBy: (values: TValues) => boolean;
}

/** A group of rules that apply together, typically mirroring one on-screen section. */
export interface ValidationSection<TValues> {
  readonly sectionId: string;
  /**
   * Whether the section applies to the current answers — a section the form
   * is not showing must not block submission. Omit for "always applies".
   */
  readonly appliesWhen?: (values: TValues) => boolean;
  readonly fields?: FieldValidators<TValues>;
  readonly checks?: readonly FormCheck<TValues>[];
}

/** One failed rule. */
export interface ValidationIssue<TField extends string> {
  readonly sectionId: string;
  readonly ruleId: string;
  /** The field to flag, or null when the issue is about the form as a whole. */
  readonly field: TField | null;
  readonly messageKey: string;
}

export interface FormValidationResult<TField extends string> {
  readonly isValid: boolean;
  /** Every failed rule, in section order. */
  readonly issues: readonly ValidationIssue<TField>[];
  /** The first failing message key per field — what each field shows beneath itself. */
  readonly fieldErrorKeys: Readonly<Partial<Record<TField, string>>>;
  /** Message keys of the issues that are about the form as a whole. */
  readonly formErrorKeys: readonly string[];
  /**
   * The fields an applicable section requires (a validator with `isRequirement`)
   * for the current values, whether filled in or not — what the form marks with "*".
   */
  readonly requiredFields: Readonly<Partial<Record<TField, boolean>>>;
}
