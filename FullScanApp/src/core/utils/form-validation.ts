import { LoggerService } from '@/infrastructure/logger';

import type {
  FieldValidator,
  FieldValidators,
  FormCheck,
  FormValidationResult,
  ValidationIssue,
  ValidationSection,
} from '@/core/types';

const FILE_NAME = 'form-validation.ts';

/**
 * Whether a value counts as "entered": a non-blank string, `true`, a non-empty
 * list, or any other non-null value. `false` is blank so a required boolean
 * reads as "must be done" (e.g. a signature that has to be captured).
 */
function hasEnteredValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Fails a blank value — see `hasEnteredValue` for what counts as blank. */
export function required(messageKey: string): FieldValidator<unknown> {
  LoggerService.info(`${FILE_NAME}: required: building validator`, { messageKey });
  return { ruleId: 'required', messageKey, isSatisfiedBy: hasEnteredValue, isRequirement: true };
}

/** Fails a number below `minimum` — e.g. "at least one photo". A minimum above 0 makes the field required. */
export function atLeast(minimum: number, messageKey: string): FieldValidator<number> {
  LoggerService.info(`${FILE_NAME}: atLeast: building validator`, { minimum, messageKey });
  return {
    ruleId: 'atLeast',
    messageKey,
    isSatisfiedBy: (value) => value >= minimum,
    isRequirement: minimum > 0,
  };
}

function collectRequiredFields<TValues>(
  fields: FieldValidators<TValues>,
): Extract<keyof TValues, string>[] {
  const requiredFields: Extract<keyof TValues, string>[] = [];
  for (const field in fields) {
    if (!Object.hasOwn(fields, field)) continue;
    if (fields[field]?.some((validator) => validator.isRequirement === true)) {
      requiredFields.push(field);
    }
  }
  return requiredFields;
}

function collectFieldIssues<TValues>(
  sectionId: string,
  values: TValues,
  fields: FieldValidators<TValues>,
): ValidationIssue<Extract<keyof TValues, string>>[] {
  const issues: ValidationIssue<Extract<keyof TValues, string>>[] = [];
  for (const field in fields) {
    if (!Object.hasOwn(fields, field)) continue;
    const failedValidator = fields[field]?.find(
      (validator) => !validator.isSatisfiedBy(values[field]),
    );
    if (failedValidator) {
      issues.push({
        sectionId,
        ruleId: failedValidator.ruleId,
        field,
        messageKey: failedValidator.messageKey,
      });
    }
  }
  return issues;
}

function collectFormIssues<TValues>(
  sectionId: string,
  values: TValues,
  checks: readonly FormCheck<TValues>[],
): ValidationIssue<Extract<keyof TValues, string>>[] {
  return checks
    .filter((check) => !check.isSatisfiedBy(values))
    .map((check) => ({
      sectionId,
      ruleId: check.ruleId,
      field: null,
      messageKey: check.messageKey,
    }));
}

/**
 * Runs every applicable section against `values` and gathers *all* failures
 * (not just the first) so the form can flag every missing field at once.
 * Failing validation is an ordinary result — this never throws for it.
 */
export function validateForm<TValues>(
  values: TValues,
  sections: readonly ValidationSection<TValues>[],
): FormValidationResult<Extract<keyof TValues, string>> {
  type TField = Extract<keyof TValues, string>;
  const issues: ValidationIssue<TField>[] = [];
  const skippedSectionIds: string[] = [];
  const requiredFields: Partial<Record<TField, boolean>> = {};

  for (const section of sections) {
    if (section.appliesWhen && !section.appliesWhen(values)) {
      skippedSectionIds.push(section.sectionId);
      continue;
    }
    for (const field of collectRequiredFields(section.fields ?? {})) {
      requiredFields[field] = true;
    }
    issues.push(
      ...collectFormIssues(section.sectionId, values, section.checks ?? []),
      ...collectFieldIssues(section.sectionId, values, section.fields ?? {}),
    );
  }

  const fieldErrorKeys: Partial<Record<TField, string>> = {};
  const formErrorKeys: string[] = [];
  for (const issue of issues) {
    if (issue.field === null) {
      formErrorKeys.push(issue.messageKey);
    } else {
      fieldErrorKeys[issue.field] ??= issue.messageKey;
    }
  }

  // Rule and field identifiers only — never the values, which can be candidate PII.
  LoggerService.info(`${FILE_NAME}: validateForm: validated`, {
    isValid: issues.length === 0,
    sectionCount: sections.length,
    skippedSectionIds,
    failedRules: issues.map(
      (issue) => `${issue.sectionId}.${issue.field ?? 'form'}.${issue.ruleId}`,
    ),
  });

  return { isValid: issues.length === 0, issues, fieldErrorKeys, formErrorKeys, requiredFields };
}
