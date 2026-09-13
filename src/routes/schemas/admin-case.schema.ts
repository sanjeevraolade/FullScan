import { z } from 'zod';

/**
 * Shape-only validation for the admin case endpoints. Whatever needs the
 * database to decide — a free case reference, a real assignee, a status code the
 * reference data defines — is enforced in `admin-case.service.ts`.
 */

const bucketSchema = z.enum(['new', 'pending', 'beyond_tat', 'completed']);
const addressTypeSchema = z.enum(['present', 'permanent', 'previous']);
const residenceTypeSchema = z.enum([
  'owned',
  'rented',
  'hostel',
  'paying_guest',
  'company_quarters',
  'relative_owned',
]);

/** An empty string from a cleared form field means "not set", not an invalid enum. */
function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.literal('')]).nullish();
}

const caseComponentInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  bucket: bucketSchema,
  componentStatus: z.string().min(1).max(100),
  actionStatus: z.string().max(100).nullish(),
  verificationType: z.string().min(1).max(100),
  addressType: optionalEnum(addressTypeSchema),
  residenceType: optionalEnum(residenceTypeSchema),
  address: z.string().min(1).max(1000),
  location: z.string().max(200).optional(),
  remarks: z.string().max(2000).optional(),
  additionalVerificationInstructions: z.string().max(2000).optional(),
  additionalVerificationRemarks: z.string().max(2000).optional(),
  assignedFieldExecutiveId: z.string().max(100).nullish(),
  assignedToName: z.string().max(200).optional(),
  tatDueAt: z.string().max(50).optional(),
  targetLatitude: z.number().min(-90).max(90).optional(),
  targetLongitude: z.number().min(-180).max(180).optional(),
  maskedPrimaryPhone: z.string().max(50).optional(),
  maskedSecondaryPhone: z.string().max(50).optional(),
  clientInstructions: z.string().max(2000).optional(),
  fieldExecutiveNotes: z.string().max(2000).optional(),
});

const caseBodySchema = z.object({
  caseRef: z.string().min(1).max(100),
  clientName: z.string().min(1).max(200),
  candidateName: z.string().min(1).max(200),
  fatherOrSpouseName: z.string().max(200).optional(),
  employerName: z.string().max(200).optional(),
  primaryContactNumber: z.string().max(50).optional(),
  secondaryContactNumber: z.string().max(50).optional(),
  profileStatus: z.string().min(1).max(100),
});

export const listAdminCasesSchema = z.object({
  query: z.object({
    bucket: bucketSchema.optional(),
    search: z.string().max(200).optional(),
    fieldExecutiveId: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
  body: z.object({}).strict().optional(),
  params: z.object({}).strict().optional(),
});

export const getAdminCaseSchema = z.object({
  params: z.object({ caseId: z.string().min(1).max(100) }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

// A case with no component is invisible to the mobile app, which lists components.
export const createAdminCaseSchema = z.object({
  body: caseBodySchema.extend({
    components: z.array(caseComponentInputSchema.omit({ id: true })).min(1).max(20),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

export const updateAdminCaseSchema = z.object({
  params: z.object({ caseId: z.string().min(1).max(100) }),
  body: caseBodySchema.extend({
    components: z.array(caseComponentInputSchema).max(20),
  }),
  query: z.object({}).strict().optional(),
});

export const listAdminFieldExecutivesSchema = z.object({
  query: z.object({ search: z.string().max(200).optional() }),
  body: z.object({}).strict().optional(),
  params: z.object({}).strict().optional(),
});

export const getFieldExecutiveHistorySchema = z.object({
  params: z.object({ fieldExecutiveId: z.string().min(1).max(100) }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
