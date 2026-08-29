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
}
