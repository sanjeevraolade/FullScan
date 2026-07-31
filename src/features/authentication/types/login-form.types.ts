/**
 * Shape of the Login form. Kept separate from the screen so the form hook,
 * the screen and future repository/session code all agree on one contract.
 */
export interface LoginFormValues {
  readonly username: string;
  readonly password: string;
  readonly employeeId: string;
  readonly rememberMe: boolean;
}

/**
 * Login-scoped error union — not a general `core/errors` taxonomy. Keys map
 * 1:1 to `login.errors.*` localization entries; the screen never sees
 * anything but one of these keys, never a raw thrown error.
 */
export type LoginErrorKey = 'invalidCredentials' | 'network' | 'serverUnavailable';
