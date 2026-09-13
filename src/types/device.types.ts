/**
 * Handset details as reported by the mobile app at login and stored as JSON
 * (`device_details`). Only these fields are ever exposed; each is null when the
 * stored details are missing, unreadable or hold a blank/non-string value.
 */
export interface DeviceDetailsView {
  readonly deviceName: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  /** e.g. `iOS`, `Android` */
  readonly systemName: string | null;
  readonly osVersion: string | null;
  /** FullScan app version installed on the device at login. */
  readonly appVersion: string | null;
}

export interface DeviceView extends DeviceDetailsView {
  readonly deviceId: string;
}
