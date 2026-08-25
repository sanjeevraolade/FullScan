/** A single device location fix, normalized for geotagging evidence. */
export interface DeviceLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  /**
   * Android only — surfaced by the platform's `Location.isFromMockProvider()`.
   * iOS exposes no equivalent public signal, so this is always `false` there.
   */
  readonly isMockLocation: boolean;
  readonly capturedAt: Date;
}

export type LocationWatchCallback = (location: DeviceLocation) => void;
export type LocationWatchErrorCallback = (error: Error) => void;
