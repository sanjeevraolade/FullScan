import { z } from 'zod';

const componentParams = z.object({
  componentId: z.string().min(1).max(100),
});

export const feWebCaseDetailSchema = z.object({
  params: componentParams,
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/** The multipart body itself is checked by `parseEvidenceUpload` and the evidence service. */
export const feWebEvidenceSchema = z.object({
  params: componentParams,
  query: z.object({}).strict().optional(),
});
