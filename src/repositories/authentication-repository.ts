import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import { TokenStorageService } from '@/infrastructure/storage';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'authentication-repository.ts';

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
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
 * Authenticates against POST /auth/login and persists the issued bearer
 * token to secure storage (Keychain/Keystore) — the api-client's request
 * interceptor reads it back from there and attaches it to every subsequent
 * authenticated request. Rejects with the underlying AxiosError on failure;
 * callers map that to a user-facing error key, never a raw message.
 */
export async function login(credentials: LoginCredentials): Promise<void> {
  // Credentials are never logged — only non-identifying metadata.
  LoggerService.info(`${FILE_NAME}: login: submitting credentials`, {
    hasUsername: credentials.username.trim().length > 0,
  });

  const response = await apiClient.post<ApiEnvelope<LoginResponseDto>>('/auth/login', credentials);
  const { token } = response.data.data;

  await TokenStorageService.saveToken(token);

  LoggerService.info(`${FILE_NAME}: login: login succeeded, token stored`);
}

/** Clears the persisted session token — call on logout or session expiry. */
export async function logout(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: logout: clearing stored session token`);
  await TokenStorageService.clearToken();
}
