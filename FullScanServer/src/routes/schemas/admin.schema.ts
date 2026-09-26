import { z } from 'zod';
import { ADMIN_ROLES } from '../../types/admin.types.js';

export const adminLoginSchema = z.object({
  body: z.object({
    // Username or email — 254 is the longest valid email address.
    username: z.string().min(1).max(254),
    password: z.string().min(1).max(200),
  }),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

/** Super admin adds an admin by email. Uniqueness is checked in `admin-user.service.ts`. */
export const createAdminUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254),
      role: z.enum(ADMIN_ROLES).default('admin'),
    })
    .strict(),
  params: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
});

const adminUserParamsSchema = z.object({ adminUserId: z.string().min(1).max(200) });

/** Promote/demote and deactivate/reactivate another admin. At least one change is required. */
export const updateAdminUserSchema = z.object({
  body: z
    .object({
      role: z.enum(ADMIN_ROLES).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((body) => body.role !== undefined || body.isActive !== undefined, {
      message: 'Provide a role, an isActive flag, or both',
    }),
  params: adminUserParamsSchema,
  query: z.object({}).strict().optional(),
});

export const deleteAdminUserSchema = z.object({
  params: adminUserParamsSchema,
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
