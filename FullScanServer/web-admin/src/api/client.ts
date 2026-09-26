import { z } from 'zod';
import type { ApiValidationIssue } from '../types/api';

/** Same-origin on purpose: the session cookie is `SameSite=Strict` and the CSP allows only 'self'. */
export const API_BASE_PATH = '/api/v1/admin';

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Check your connection and try again.';
const UNEXPECTED_RESPONSE_MESSAGE = 'The server sent an unexpected response. Please try again.';

export class ApiError extends Error {
  readonly status: number;
  readonly details: readonly ApiValidationIssue[];

  constructor(status: number, message: string, details: readonly ApiValidationIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** `status` 0 means the request never got an HTTP answer. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Turns anything thrown into a message fit for the UI. */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

const envelopeSchema = z.union([
  z.object({ success: z.literal(true), data: z.unknown() }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
]);

type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

/**
 * Registers what happens when the session is gone for good (the auth store clears
 * itself, and the protected routes send the user to the login page).
 */
export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

function notifyUnauthorized(): void {
  unauthorizedListener?.();
}

type ForbiddenListener = () => void;
let forbiddenListener: ForbiddenListener | null = null;

/**
 * Registers what happens on a 403. Roles are read from the live account row on
 * every request, so a 403 usually means this admin was demoted mid-session — the
 * auth store re-reads the profile and the menu drops what the role can no longer open.
 */
export function setForbiddenListener(listener: ForbiddenListener | null): void {
  forbiddenListener = listener;
}

function unwrapEnvelope<TData>(status: number, payload: unknown, schema: z.ZodType<TData>): TData {
  const envelope = envelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new ApiError(status, UNEXPECTED_RESPONSE_MESSAGE);
  }

  if (!envelope.data.success) {
    throw new ApiError(status, envelope.data.error, envelope.data.details ?? []);
  }

  const data = schema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new ApiError(status, UNEXPECTED_RESPONSE_MESSAGE);
  }
  return data.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, response.ok ? UNEXPECTED_RESPONSE_MESSAGE : `Request failed (${response.status})`);
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /**
   * Skip the 401 recovery step. Set for the auth endpoints themselves, where a 401
   * is an answer (wrong password, no session) rather than an expired session.
   */
  readonly isAuthRequest?: boolean;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const hasBody = options.body !== undefined;

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    return await fetch(`${API_BASE_PATH}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
}

let sessionRecovery: Promise<boolean> | null = null;

/**
 * The cookie-session equivalent of a token refresh. The web token lives in an
 * httpOnly cookie with no refresh endpoint, so the app cannot renew it — but the
 * cookie may have been replaced since the failed request left (a sign-in in another
 * tab). One shared `/auth/me` probe answers that for every request that hit a 401
 * at the same moment.
 */
function recoverSession(): Promise<boolean> {
  if (!sessionRecovery) {
    sessionRecovery = send('/auth/me', { isAuthRequest: true })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        sessionRecovery = null;
      });
  }
  return sessionRecovery;
}

/**
 * Calls the field executive web API, unwraps the `{ success, data }` envelope and
 * validates `data` against `schema`.
 *
 * On a 401 from a non-auth endpoint it re-checks the session once and retries the
 * request if the session is valid again; otherwise it signals the session has ended
 * and throws.
 */
export async function apiRequest<TData>(
  path: string,
  schema: z.ZodType<TData>,
  options: RequestOptions = {},
): Promise<TData> {
  let response = await send(path, options);

  if (response.status === 401 && !options.isAuthRequest) {
    const isSessionValid = await recoverSession();

    if (isSessionValid) {
      response = await send(path, options);
    }

    if (response.status === 401) {
      notifyUnauthorized();
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
    }
  }

  if (response.status === 403) {
    forbiddenListener?.();
  }

  return unwrapEnvelope(response.status, await readJson(response), schema);
}
