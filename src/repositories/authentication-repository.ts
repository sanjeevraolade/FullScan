import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'authentication-repository.ts';

/** Simulated round-trip latency for the placeholder login stub below. */
const SIMULATED_LOGIN_DELAY_MS = 600;

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * Placeholder stub for the future Authentication Repository — simulates a
 * network round-trip and always resolves successfully; no real request is
 * made. Real credential verification, token issuance and session storage
 * arrive with the networking/auth layer, at which point this function's body
 * (not its call sites) is the only thing that needs to change.
 */
export async function login(credentials: LoginCredentials): Promise<void> {
  // Credentials are never logged — only non-identifying metadata.
  LoggerService.info(`${FILE_NAME}: login: submitting credentials`, {
    hasUsername: credentials.username.trim().length > 0,
  });

  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_LOGIN_DELAY_MS);
  });

  LoggerService.info(`${FILE_NAME}: login: simulated login succeeded`);
}
