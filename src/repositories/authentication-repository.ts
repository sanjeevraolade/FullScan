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

interface LoginResponseDto {
  readonly token: string;
  readonly fieldExecutive: FieldExecutive;
}

/**
 * Authenticates against POST /auth/login with device binding info and persists
 * the issued bearer token to secure storage (Keychain/Keystore) — the api-client's
 * request interceptor reads it back from there and attaches it to every subsequent
 * authenticated request. Rejects with the underlying AxiosError on failure;
 * callers map that to a user-facing error key, never a raw message.
 */
export async function login(credentials: LoginCredentials): Promise<void> {
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
    fieldExecutiveId: response.data.data.fieldExecutive.id,
  });

  await TokenStorageService.saveToken(token);

  LoggerService.info(`${FILE_NAME}: login: login succeeded, token stored, device bound`);
}

/** Clears the persisted session token — call on logout or session expiry. */
export async function logout(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: logout: clearing stored session token`);
  await TokenStorageService.clearToken();
  LoggerService.info(`${FILE_NAME}: logout: stored session token cleared`);
}
