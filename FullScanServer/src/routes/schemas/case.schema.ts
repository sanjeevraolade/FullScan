import { z } from 'zod';
import { CASE_LIST_TYPES } from '../../types/case.types.js';

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

const respondentSchema = z.object({
  name: z.string().min(1).max(200),
  relation: z.string().min(1).max(100),
});

export const submitVerificationOutcomeSchema = z.object({
  params: z.object({
    caseId: z.string().min(1).max(100),
  }),
  body: z.object({
    verificationStatus: z.string().min(1).max(100),
    utvReason: z.string().max(200).nullable(),
    utvRemarks: z.string().max(2000).nullable(),
    insufficientReason: z.string().max(200).nullable(),
    insufficientRemarks: z.string().max(2000).nullable(),
    residenceType: z.enum(['owned', 'rented', 'hostel', 'paying_guest', 'company_quarters', 'relative_owned']).nullable(),
    addressType: z.enum(['present', 'permanent', 'previous']).nullable(),
    respondent: respondentSchema.nullable(),
    isSignatureCaptured: z.boolean(),
  }),
  query: z.object({}).strict().optional(),
});

/* ------------------------------------------------ POST /cases/:caseId/evidence */

/** A decimal number as multipart text: optional sign, digits, optional fraction and exponent. */
const DECIMAL_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function decimalText(label: string, range: z.ZodNumber) {
  return z
    .string()
    .regex(DECIMAL_TEXT, `${label} must be a decimal number`)
    .transform(Number)
    .pipe(range);
}

/**
 * The text parts of a mobile capture upload. Multipart text is always a string, so
 * numbers and booleans are parsed here. Exported on its own so the controller can read
 * the typed, converted values back: `validate()` checks the request but does not write
 * parsed values to `req.body`.
 */
export const mobileEvidenceBodySchema = z
  .object({
    documentTypeCode: z.string().min(1).max(100),
    latitude: decimalText('latitude', z.number().finite().min(-90).max(90)),
    longitude: decimalText('longitude', z.number().finite().min(-180).max(180)),
    accuracyMeters: decimalText('accuracyMeters', z.number().finite().min(0)),
    capturedAt: z.string().datetime({ offset: true, message: 'capturedAt must be an ISO 8601 datetime with an offset or Z' }),
    isMockLocation: z
      .enum(['true', 'false'], { message: 'isMockLocation must be "true" or "false"' })
      .transform((value) => value === 'true'),
  })
  .strict();

const caseEvidenceParams = z.object({
  caseId: z.string().min(1).max(100),
});

/** Checked before the multipart body is read: just the target and the query. */
export const uploadCaseEvidenceTargetSchema = z.object({
  params: caseEvidenceParams,
  query: z.object({}).strict().optional(),
});

/** Checked after `parseMobileEvidenceUpload` has put the text parts on `req.body`. */
export const uploadCaseEvidenceSchema = z.object({
  params: caseEvidenceParams,
  body: mobileEvidenceBodySchema,
  query: z.object({}).strict().optional(),
});
