export interface FieldExecutive {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

export interface FieldExecutiveRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly username: string;
  readonly password_hash: string;
  readonly created_at: string;
  readonly device_id?: string | null;
  readonly device_details?: string | null;
  /**
   * The account's current mobile session version — absent on accounts that have never
   * signed in to the app since session revocation shipped, and read as 0 then. A mobile
   * token is valid only while its `sessionVersion` claim equals this value; mobile login
   * and logout increment it (docs/api-contracts/mobile-logout.md).
   */
  readonly mobile_session_version?: number;
}
