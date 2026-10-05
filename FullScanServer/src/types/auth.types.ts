import type { FieldExecutive } from './field-executive.types.js';

export interface DeviceDetails {
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly systemName: string;
  readonly uniqueId: string;
  readonly [key: string]: unknown;
}

export interface LoginInput {
  readonly username: string;
  readonly password: string;
  readonly deviceId: string;
  readonly deviceDetails: DeviceDetails;
}

export interface LoginResult {
  readonly token: string;
  readonly fieldExecutive: FieldExecutive;
  /**
   * The current master-data version — equal to `GET /master-data`'s `updatedAt` while
   * master data is unchanged — or `null` when none is recorded. Opaque to the app.
   */
  readonly masterDataUpdatedAt: string | null;
}

export interface JwtPayload {
  readonly fieldExecutiveId: string;
  /** Absent on mobile tokens. Present on admin (`admin`) and FE web (`fe_web`) tokens. */
  readonly scope?: string;
  /**
   * Mobile tokens only: the account's `mobile_session_version` when the token was issued.
   * Absent on tokens issued before session revocation shipped, which read as 0.
   */
  readonly sessionVersion?: number;
}

/** A verified mobile session: the bearer's account and the session version its token carries. */
export interface MobileSession {
  readonly fieldExecutiveId: string;
  readonly sessionVersion: number;
}
