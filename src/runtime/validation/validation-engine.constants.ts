export const VALIDATION_ENGINE_READY_MESSAGE =
  'Validation Engine initialized (required-field checks only — pattern/range/GPS/attachment/business-rule types not implemented yet)';

/**
 * Generic required-field message, per docs/06-Contracts/05-Validation-Schema.md's
 * `messageKey` convention. Kept as a single shared key rather than one per
 * widget/screen — the message ("This field is required") never needs to
 * vary by field.
 */
export const VALIDATION_REQUIRED_MESSAGE_KEY = 'validation.required';
