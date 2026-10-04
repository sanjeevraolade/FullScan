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
