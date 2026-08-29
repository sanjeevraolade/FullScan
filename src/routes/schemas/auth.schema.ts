import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
