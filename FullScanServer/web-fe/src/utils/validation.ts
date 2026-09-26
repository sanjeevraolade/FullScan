import { z } from 'zod';
import {
  EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_BYTES,
  MAX_EVIDENCE_FILES,
  type EvidenceMimeType,
} from '../types/evidence';
import { formatBytes } from './format';

/** Same bounds as the server's `feWebLoginSchema`. */
export const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your username')
    .max(100, 'Username must be 100 characters or fewer'),
  password: z.string().min(1, 'Enter your password').max(200, 'Password must be 200 characters or fewer'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

export type ValidationResult<TValue, TErrors> =
  | { readonly isValid: true; readonly value: TValue }
  | { readonly isValid: false; readonly errors: TErrors };

export function validateLoginForm(input: unknown): ValidationResult<LoginFormValues, LoginFormErrors> {
  const result = loginFormSchema.safeParse(input);

  if (result.success) {
    return { isValid: true, value: result.data };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors: LoginFormErrors = {};
  if (fieldErrors.username?.[0]) {
    errors.username = fieldErrors.username[0];
  }
  if (fieldErrors.password?.[0]) {
    errors.password = fieldErrors.password[0];
  }
  return { isValid: false, errors };
}

function isEvidenceMimeType(type: string): type is EvidenceMimeType {
  return (EVIDENCE_MIME_TYPES as readonly string[]).includes(type);
}

/** The subset of `File` the checks need, so they run without a DOM. */
export interface SelectableFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

const evidenceFileSchema = z
  .object({ name: z.string(), size: z.number(), type: z.string() })
  .superRefine((file, context) => {
    if (!isEvidenceMimeType(file.type)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${file.name}: only JPEG, PNG or WebP images` });
    }
    if (file.size === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${file.name}: the file is empty` });
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${file.name}: larger than ${formatBytes(MAX_EVIDENCE_FILE_BYTES)}`,
      });
    }
  });

export const evidenceSelectionSchema = z
  .array(evidenceFileSchema)
  .min(1, 'Choose at least one image')
  .max(MAX_EVIDENCE_FILES, `Upload at most ${MAX_EVIDENCE_FILES} images at a time`);

/**
 * Client-side pre-check so the executive hears about a bad file before waiting on an
 * upload. The server re-checks everything, including the real image type.
 */
export function validateEvidenceSelection(files: readonly SelectableFile[]): readonly string[] {
  const result = evidenceSelectionSchema.safeParse(
    files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
  );
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.message))];
}
