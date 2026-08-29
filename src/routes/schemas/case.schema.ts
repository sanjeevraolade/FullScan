import { z } from 'zod';

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
