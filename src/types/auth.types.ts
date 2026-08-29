import type { FieldExecutive } from './field-executive.types.js';

export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

export interface LoginResult {
  readonly token: string;
  readonly fieldExecutive: FieldExecutive;
}

export interface JwtPayload {
  readonly fieldExecutiveId: string;
}
