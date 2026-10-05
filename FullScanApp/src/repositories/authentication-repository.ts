import axios from 'axios';

import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import { TokenStorageService } from '@/infrastructure/storage';
import { getDeviceId, getDeviceInfo } from '@/infrastructure/device';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'authentication-repository.ts';

export interface DeviceDetails {
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly systemName: string;
  readonly uniqueId: string;
}

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

interface LoginRequest {
  readonly username: string;
  readonly password: string;
  readonly deviceId: string;
  readonly deviceDetails: DeviceDetails;
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

/** Same shape as `GET /me`'s `data` — both are built by the server's `toFieldExecutive()`. */
interface FieldExecutiveDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

interface LoginResponseDto {
  readonly token: string;
  readonly fieldExecutive: FieldExecutiveDto;
  /** Absent from a server that predates master-data versioning. */
  readonly masterDataUpdatedAt?: string | null;
}

export interface LoginResult {
  readonly fieldExecutive: FieldExecutive;
  /**
   * The server's current master-data version, or null when it has none or
   * predates versioning. Opaque — hand it to `loadReferenceData` as-is; it is
   * only ever compared for equality, never parsed or ordered.
   */
  readonly masterDataUpdatedAt: string | null;
}

function mapFieldExecutive(dto: FieldExecutiveDto): FieldExecutive {
  // Name and email identify a person — only the id and role are logged.
  LoggerService.info(`${FILE_NAME}: mapFieldExecutive: mapping field executive profile`, {
    fieldExecutiveId: dto.id,
    role: dto.role,
  });
  return { id: dto.id, name: dto.name, email: dto.email, role: dto.role };
}

/**
 * Authenticates against POST /auth/login with device binding info, persists
 * the issued bearer token to secure storage (Keychain/Keystore) — the api-client's
 * request interceptor reads it back from there and attaches it to every subsequent
 * authenticated request — and resolves with the logged-in field executive's
 * profile, which the login response carries so no separate `GET /me` is needed,
 * plus the server's master-data version, which decides whether the post-login
 * `GET /master-data` can be skipped (see `loadReferenceData`).
 * Resolves only once the token is stored. Rejects with the underlying AxiosError
 * on failure; callers map that to a user-facing error key, never a raw message.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  // Credentials are never logged — only non-identifying metadata.
  LoggerService.info(`${FILE_NAME}: login: submitting credentials with device binding`, {
    hasUsername: credentials.username.trim().length > 0,
  });

  const deviceId = await getDeviceId();
  const deviceInfo = await getDeviceInfo();
  LoggerService.info(`${FILE_NAME}: login: device binding info resolved`, {
    hasDeviceId: deviceId.length > 0,
    platform: deviceInfo.systemName,
    osVersion: deviceInfo.osVersion,
    appVersion: deviceInfo.appVersion,
  });

  const loginRequest: LoginRequest = {
    username: credentials.username,
    password: credentials.password,
    deviceId,
    deviceDetails: deviceInfo,
  };

  const response = await apiClient.post<ApiEnvelope<LoginResponseDto>>('/auth/login', loginRequest);
  const { token } = response.data.data;

  // The token itself is a secret — only its presence is ever logged.
  LoggerService.info(`${FILE_NAME}: login: response received`, {
    success: response.data.success,
    hasToken: token.length > 0,
  });

  // Mapped before the token is stored: if the profile can't be read, the login
  // rejects without leaving a token behind for a session that never starts.
  const fieldExecutive = mapFieldExecutive(response.data.data.fieldExecutive);
  const masterDataUpdatedAt = response.data.data.masterDataUpdatedAt ?? null;

  await TokenStorageService.saveToken(token);

  // The master-data version is a timestamp, not personal data — safe to log.
  LoggerService.info(`${FILE_NAME}: login: login succeeded, token stored, device bound`, {
    fieldExecutiveId: fieldExecutive.id,
    role: fieldExecutive.role,
    masterDataUpdatedAt,
  });
  return { fieldExecutive, masterDataUpdatedAt };
}

/** Reads the token to revoke. A storage failure reads as "no token": logout must still proceed. */
async function readStoredToken(): Promise<string | null> {
  LoggerService.info(`${FILE_NAME}: readStoredToken: reading session token to revoke`);
  try {
    const token = await TokenStorageService.getToken();
    LoggerService.info(`${FILE_NAME}: readStoredToken: session token read`, {
      hasToken: Boolean(token),
    });
    return token;
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: readStoredToken: secure storage read failed`, {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}

async function clearStoredToken(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: clearStoredToken: clearing stored session token`);
  try {
    await TokenStorageService.clearToken();
    LoggerService.info(`${FILE_NAME}: clearStoredToken: stored session token cleared`);
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: clearStoredToken: secure storage clear failed`, {
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}

/**
 * Best-effort `POST /auth/logout`. The token goes in an explicit header because
 * storage no longer holds it — the api-client interceptor keeps a caller-supplied
 * Authorization header rather than replacing it with whatever storage holds now.
 * Failures are only logged: the device is already signed out locally.
 */
async function revokeServerSession(token: string): Promise<void> {
  LoggerService.info(`${FILE_NAME}: revokeServerSession: requesting server-side sign-out`);
  try {
    // The body (`{ signedOut: true }`) isn't read: a 2xx is the confirmation.
    const response = await apiClient.post<unknown>('/auth/logout', undefined, {
      headers: { Authorization: `Bearer ${token}` },
    });
    LoggerService.info(`${FILE_NAME}: revokeServerSession: server session revoked`, {
      status: response.status,
    });
  } catch (error: unknown) {
    // Status and error kind only — never the token, the error message or the response body.
    // A 401 (already revoked/expired) or a network failure/timeout leaves nothing to undo.
    const isAxiosError = axios.isAxiosError(error);
    LoggerService.warn(`${FILE_NAME}: revokeServerSession: server sign-out failed, ignoring`, {
      isAxiosError,
      status: isAxiosError ? error.response?.status : undefined,
    });
  }
}

/**
 * Signs this device out — call on logout or session expiry. Never rejects, so
 * callers can fire and forget it without blocking the user on the network.
 *
 * 1. Reads the stored token; with none there is nothing to revoke, so storage is
 *    only cleared and no request is made.
 * 2. Clears the stored token *before* any network call: if a re-login saves a new
 *    token while the request below is still in flight, nothing here wipes it.
 * 3. Sends `POST /auth/logout` with the captured token, best-effort. Network
 *    errors, timeouts and 401s are logged (status only) and swallowed; the server
 *    only revokes the presented token's session, never a newer login's.
 */
export async function logout(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: logout: signing out`);
  const token = await readStoredToken();
  await clearStoredToken();

  if (!token) {
    LoggerService.info(`${FILE_NAME}: logout: no stored session token, skipping server sign-out`);
    return;
  }

  await revokeServerSession(token);
  LoggerService.info(`${FILE_NAME}: logout: signed out`);
}
