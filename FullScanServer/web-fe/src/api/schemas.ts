import { z } from 'zod';
import type { FieldExecutive, LoginResult } from '../types/auth';
import type { AssignmentDetail, AssignmentList } from '../types/assignment';
import type { EvidenceList } from '../types/evidence';

/**
 * Runtime checks for every response the app consumes. A server change that breaks
 * the contract surfaces as one clear error instead of `undefined` deep in a render.
 * Each schema is pinned to its interface, so the two cannot drift apart silently.
 */

export const fieldExecutiveSchema: z.ZodType<FieldExecutive> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

export const loginResultSchema: z.ZodType<LoginResult> = z.object({
  expiresInSeconds: z.number(),
  fieldExecutive: fieldExecutiveSchema,
});

export const signOutResultSchema = z.object({ signedOut: z.literal(true) });

const bucketSchema = z.enum(['pending', 'beyond_tat', 'completed']);

const assignmentSummarySchema = z.object({
  componentId: z.string(),
  caseId: z.string(),
  caseRef: z.string(),
  clientName: z.string(),
  candidateName: z.string(),
  verificationType: z.string(),
  addressType: z.string().nullable(),
  address: z.string(),
  componentStatus: z.string(),
  componentStatusLabel: z.string(),
  tatDueAt: z.string(),
  updatedAt: z.string(),
});

export const assignmentListSchema: z.ZodType<AssignmentList> = z.object({
  caseGroups: z.array(
    z.object({
      bucket: bucketSchema,
      caseCount: z.number().int().nonnegative(),
      cases: z.array(assignmentSummarySchema),
    }),
  ),
});

export const assignmentDetailSchema: z.ZodType<AssignmentDetail> = z.object({
  componentId: z.string(),
  caseId: z.string(),
  caseRef: z.string(),
  bucket: bucketSchema,
  clientName: z.string(),
  candidateName: z.string(),
  fatherOrSpouseName: z.string(),
  employerName: z.string(),
  verificationType: z.string(),
  addressType: z.string().nullable(),
  residenceType: z.string().nullable(),
  address: z.string(),
  location: z.string(),
  componentStatus: z.string(),
  componentStatusLabel: z.string(),
  clientInstructions: z.string(),
  tatDueAt: z.string(),
  updatedAt: z.string(),
  canUploadEvidence: z.boolean(),
  siblingComponents: z.array(
    z.object({
      componentId: z.string(),
      verificationType: z.string(),
      addressType: z.string().nullable(),
      componentStatusLabel: z.string(),
      isAssignedToYou: z.boolean(),
    }),
  ),
});

export const evidenceListSchema: z.ZodType<EvidenceList> = z.object({
  componentId: z.string(),
  evidence: z.array(
    z.object({
      id: z.string(),
      componentId: z.string(),
      source: z.enum(['web_upload', 'mobile_capture']),
      fileName: z.string(),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      sizeBytes: z.number().int().positive(),
      sha256: z.string(),
      documentTypeCode: z.string().nullable(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      accuracyMeters: z.number().nullable(),
      isMockLocation: z.boolean().nullable(),
      capturedAt: z.string().nullable(),
      uploadedAt: z.string(),
    }),
  ),
});
