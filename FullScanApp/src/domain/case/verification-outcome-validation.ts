import { LoggerService } from '@/infrastructure/logger';
import { atLeast, required, validateForm } from '@/core/utils';
import type { FormValidationResult, ValidationSection } from '@/core/types';

import { VERIFICATION_STATUS_VERIFIED_CLEAR } from './case-detail.entity';
import type { AddressType, ResidenceType } from './case-detail.entity';

const FILE_NAME = 'verification-outcome-validation.ts';

/** Everything the field executive has entered for a case's outcome, as it stands at Submit. */
export interface VerificationOutcomeAnswers {
  /** A `ReferenceData.verificationTypeStatuses` code, or '' while none is selected. */
  readonly verificationStatus: string;
  readonly utvReason: string;
  readonly utvRemarks: string;
  readonly insufficientReason: string;
  readonly insufficientRemarks: string;
  readonly residenceType: ResidenceType | null;
  readonly addressType: AddressType | null;
  readonly respondentName: string;
  readonly respondentRelation: string;
  readonly isSignatureCaptured: boolean;
  readonly capturedPhotoCount: number;
}

export type VerificationOutcomeAnswerField = Extract<keyof VerificationOutcomeAnswers, string>;

export type VerificationOutcomeValidationResult =
  FormValidationResult<VerificationOutcomeAnswerField>;

/** Each outcome field's validation error, as a localization key. */
export type VerificationOutcomeFieldErrorKeys =
  VerificationOutcomeValidationResult['fieldErrorKeys'];

/** Which outcome fields are mandatory for the current answers — what the form marks with "*". */
export type VerificationOutcomeRequiredFields =
  VerificationOutcomeValidationResult['requiredFields'];

const REQUIRED_MESSAGE_KEY = 'validation.required';

/*
 * The verification status is what every other outcome section hangs off, so
 * "has an outcome been entered" is "has a status been chosen" — photos on
 * their own are evidence for an outcome, not an outcome.
 */
function hasSelectedStatus(answers: VerificationOutcomeAnswers): boolean {
  return answers.verificationStatus.trim().length > 0;
}

/**
 * The Submit rules for a verification outcome, one entry per form section.
 * To make another section mandatory, add an entry here: say when it applies
 * and which fields it requires — the screen already shows each field's error.
 */
export const VERIFICATION_OUTCOME_VALIDATION_SECTIONS: readonly ValidationSection<VerificationOutcomeAnswers>[] =
  [
    {
      sectionId: 'submission',
      checks: [
        {
          ruleId: 'somethingEntered',
          messageKey: 'caseDetails.validation.nothingEntered',
          isSatisfiedBy: (answers) => hasSelectedStatus(answers) || answers.capturedPhotoCount > 0,
        },
        {
          ruleId: 'notPhotosOnly',
          messageKey: 'caseDetails.validation.photosOnly',
          isSatisfiedBy: (answers) =>
            hasSelectedStatus(answers) || answers.capturedPhotoCount === 0,
        },
      ],
    },
    {
      sectionId: 'outcome',
      fields: {
        verificationStatus: [required(REQUIRED_MESSAGE_KEY)],
      },
    },
    {
      // Every outcome needs camera evidence of the visit, whatever its status.
      sectionId: 'evidence',
      fields: {
        capturedPhotoCount: [atLeast(1, 'caseDetails.validation.photoRequired')],
      },
    },
    {
      sectionId: 'verifiedResidence',
      appliesWhen: (answers) => answers.verificationStatus === VERIFICATION_STATUS_VERIFIED_CLEAR,
      fields: {
        residenceType: [required(REQUIRED_MESSAGE_KEY)],
        addressType: [required(REQUIRED_MESSAGE_KEY)],
        respondentName: [required(REQUIRED_MESSAGE_KEY)],
        respondentRelation: [required(REQUIRED_MESSAGE_KEY)],
        isSignatureCaptured: [required(REQUIRED_MESSAGE_KEY)],
      },
    },
  ];

/** Whether a verification outcome is complete enough to submit, and if not, what is missing. */
export function validateVerificationOutcome(
  answers: VerificationOutcomeAnswers,
): VerificationOutcomeValidationResult {
  // Status code and counts only — the answers themselves can be respondent PII.
  LoggerService.info(`${FILE_NAME}: validateVerificationOutcome: validating`, {
    verificationStatus: answers.verificationStatus,
    capturedPhotoCount: answers.capturedPhotoCount,
  });
  return validateForm(answers, VERIFICATION_OUTCOME_VALIDATION_SECTIONS);
}
