import { z } from 'zod';

export const adminLoginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/**
 * Shape-only validation. Whether a value is legal *for its setting* (right type,
 * within min/max, an allowed enum option) depends on the row's metadata and is
 * enforced in `mobile-app-setting.service.ts`.
 */
export const updateMobileAppSettingsSchema = z.object({
  body: z.object({
    settings: z
      .array(
        z.object({
          key: z.string().min(1).max(100),
          value: z.union([z.boolean(), z.number(), z.string().max(500)]),
        }),
      )
      .min(1)
      .max(100),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});
