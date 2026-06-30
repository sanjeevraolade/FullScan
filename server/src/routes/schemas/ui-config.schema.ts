import { z } from 'zod';

const fieldConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'date', 'location', 'status', 'image', 'badge']),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const componentConfigSchema = z.object({
  type: z.enum(['card', 'list', 'form', 'detail', 'header']),
  fields: z.array(fieldConfigSchema).min(1),
});

export const updateUiConfigSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(100),
    components: z.array(componentConfigSchema).min(1),
  }),
  params: z.object({
    screenId: z.string().min(1).max(100),
  }),
  query: z.object({}).strict(),
});

export const getByScreenIdSchema = z.object({
  params: z.object({
    screenId: z.string().min(1).max(100),
  }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
