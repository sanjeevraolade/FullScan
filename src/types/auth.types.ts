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
}

export interface JwtPayload {
  readonly fieldExecutiveId: string;
}
