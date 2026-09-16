import { z } from 'zod';
import type { AdminRole } from '../types/auth';

export type FieldErrors<TField extends string> = Partial<Record<TField, string>>;

export type ValidationResult<TValue, TField extends string> =
  | { readonly isValid: true; readonly value: TValue }
  | { readonly isValid: false; readonly errors: FieldErrors<TField> };

function validateWith<TSchema extends z.ZodObject<z.ZodRawShape>>(
  schema: TSchema,
  input: unknown,
): ValidationResult<z.infer<TSchema>, Extract<keyof z.infer<TSchema>, string>> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { isValid: true, value: result.data };
  }

  const errors: FieldErrors<Extract<keyof z.infer<TSchema>, string>> = {};
  for (const issue of result.error.issues) {
    const [field] = issue.path;
    if (typeof field === 'string' && field in schema.shape) {
      const key = field as Extract<keyof z.infer<TSchema>, string>;
      errors[key] ??= issue.message;
    }
  }
  return { isValid: false, errors };
}

/** Same bounds as the server's `adminLoginSchema`: username or email. */
export const loginFormSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username or email').max(254, 'Must be 254 characters or fewer'),
  password: z.string().min(1, 'Enter your password').max(200, 'Password must be 200 characters or fewer'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export function validateLoginForm(input: unknown) {
  return validateWith(loginFormSchema, input);
}

/** Same bounds as the server's `createAdminUserSchema`. */
export const newAdminFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the new admin’s full name').max(100, 'Must be 100 characters or fewer'),
  email: z.string().trim().email('Enter a valid email address').max(254, 'Must be 254 characters or fewer'),
  role: z.enum(['admin', 'super_admin'] satisfies [AdminRole, AdminRole]),
});

export type NewAdminFormValues = z.infer<typeof newAdminFormSchema>;

export function validateNewAdminForm(input: unknown) {
  return validateWith(newAdminFormSchema, input);
}

export const DECISION_NOTE_MAX_LENGTH = 500;
