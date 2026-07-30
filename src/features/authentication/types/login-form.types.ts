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
