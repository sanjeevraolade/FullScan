import { z } from 'zod';
import { CASE_LIST_TYPES, VERIFIED_CLEAR_STATUS } from '../../types/case.types.js';
import { isStrictBase64 } from '../../utils/base64.js';

/**
 * `GET /cases` query. `type` selects one tab; without it the deprecated all-buckets
 * response is served. `cursor` is opaque — it is decoded (and rejected with
 * `400 Invalid cursor`) by the service, so only its type is checked here. A cursor
 * belongs to a tab, so one without `type` is a validation failure.
 *
 * Exported on its own so the controller can read the query back typed:
 * `validate()` checks the request but does not write parsed values to `req.query`.
 */
export const caseListQuerySchema = z
  .object({
    type: z.enum(CASE_LIST_TYPES).optional(),
    cursor: z.string().optional(),
  })
  .strict()
  .refine((query) => query.type !== undefined || query.cursor === undefined, {
    message: 'cursor requires type',
    path: ['cursor'],
  });

export const listCasesSchema = z.object({
  body: z.object({}).strict().optional(),
  query: caseListQuerySchema,
});

export const getCaseCountsSchema = z.object({
  body: z.object({}).strict().optional(),
  query: z.object({}).strict(),
});

export const acceptCaseSchema = z.object({
  params: z.object({
    caseId: z.string().min(1).max(100),
  }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

export const getCaseDetailSchema = z.object({
  params: z.object({
    caseId: z.string().min(1).max(100),
  }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/** Both values are trimmed before the length checks, so whitespace-only is rejected and the trimmed value is stored. */
const respondentSchema = z.object({
  name: z.string().trim().min(1, 'respondent name must not be blank').max(200),
  relation: z.string().trim().min(1, 'respondent relation must not be blank').max(100),
});

type OutcomeRuleField = 'residenceType' | 'addressType' | 'respondent' | 'isSignatureCaptured';

/**
 * The `POST /cases/:caseId/verification-outcome` body — docs/api-contracts/verification-outcome-submission.md.
 * Every key is required. Not strict: other keys are ignored (stripped on parse), as before.
 *
 * The cross-field rules run once every field has the right type, and add one issue per
 * failing field, so `validate()` lists each as `body.<field>`. The `verified_clear` rules
 * mirror the app's `FullScanApp/src/domain/case/verification-outcome-validation.ts` —
 * change both sides, and the contract, together. Whether `verificationStatus` is a real
 * `verification_type_status` code is the service's check (it needs the reference data).
 *
 * Exported on its own so the controller can read the typed, trimmed values back:
 * `validate()` checks the request but does not write parsed values to `req.body`.
 */
export const verificationOutcomeBodySchema = z
  .object({
    verificationStatus: z.string().min(1).max(100),
    utvReason: z.string().max(200).nullable(),
    utvRemarks: z.string().max(2000).nullable(),
    insufficientReason: z.string().max(200).nullable(),
    insufficientRemarks: z.string().max(2000).nullable(),
    residenceType: z.enum(['owned', 'rented', 'hostel', 'paying_guest', 'company_quarters', 'relative_owned']).nullable(),
    addressType: z.enum(['present', 'permanent', 'previous']).nullable(),
    respondent: respondentSchema.nullable(),
    isSignatureCaptured: z.boolean(),
    currentLatitude: z.number().min(-90).max(90).nullable(),
    currentLongitude: z.number().min(-180).max(180).nullable(),
    // `finite()`: JSON such as `1e999` parses to Infinity, which `min(0)` alone lets through.
    distanceToCaseMeters: z.number().finite().min(0).nullable(),
    // Never defaulted: a silent `false` would hide a geo-fence bypass.
    forceProceed: z.boolean(),
  })
  .superRefine((outcome, ctx) => {
    if (outcome.currentLatitude === null && outcome.currentLongitude !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentLatitude'],
        message: 'currentLatitude must be a number when currentLongitude is set',
      });
    }

    if (outcome.currentLongitude === null && outcome.currentLatitude !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentLongitude'],
        message: 'currentLongitude must be a number when currentLatitude is set',
      });
    }

    if (outcome.verificationStatus !== VERIFIED_CLEAR_STATUS) {
      return;
    }

    const failures: readonly [OutcomeRuleField, boolean, string][] = [
      ['residenceType', outcome.residenceType === null, `residenceType is required for ${VERIFIED_CLEAR_STATUS}`],
      ['addressType', outcome.addressType === null, `addressType is required for ${VERIFIED_CLEAR_STATUS}`],
      ['respondent', outcome.respondent === null, `respondent is required for ${VERIFIED_CLEAR_STATUS}`],
      ['isSignatureCaptured', !outcome.isSignatureCaptured, `isSignatureCaptured must be true for ${VERIFIED_CLEAR_STATUS}`],
    ];

    for (const [field, failed, message] of failures) {
      if (failed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    }
  });

export const submitVerificationOutcomeSchema = z.object({
  params: z.object({
    caseId: z.string().min(1).max(100),
  }),
  body: verificationOutcomeBodySchema,
  query: z.object({}).strict().optional(),
});

/* ------------------------------------------------ POST /cases/:caseId/evidence */

/**
 * The JSON body of a mobile capture upload. Strict: numbers and booleans must be real
 * JSON types, and no other field is accepted. `contentBase64` is checked as strict
 * base64 here, before anything decodes it; its decoded size (413) and type (415) are
 * the service's. No message here quotes the submitted value.
 *
 * Exported on its own so the controller can read the typed values back: `validate()`
 * checks the request but does not write parsed values to `req.body`.
 */
const STRICT_BASE64_MESSAGE =
  'contentBase64 must be standard base64 (A-Z a-z 0-9 + /, = padding, length a multiple of 4) with no data: prefix or whitespace';

export const mobileEvidenceBodySchema = z
  .object({
    documentTypeCode: z.string().min(1).max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0),
    capturedAt: z.string().datetime({ offset: true, message: 'capturedAt must be an ISO 8601 datetime with an offset or Z' }),
    isMockLocation: z.boolean(),
    fileName: z.string().min(1).max(255),
    contentBase64: z.string().superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contentBase64 must not be empty' });
      } else if (!isStrictBase64(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: STRICT_BASE64_MESSAGE });
      }
    }),
  })
  .strict();

const caseEvidenceParams = z.object({
  caseId: z.string().min(1).max(100),
});

/** Checked before the body is parsed: just the target and the query. */
export const uploadCaseEvidenceTargetSchema = z.object({
  params: caseEvidenceParams,
  query: z.object({}).strict().optional(),
});

/** Checked after `parseMobileEvidenceJson` has parsed the body. */
export const uploadCaseEvidenceSchema = z.object({
  params: caseEvidenceParams,
  body: mobileEvidenceBodySchema,
  query: z.object({}).strict().optional(),
});
