/**
 * Where in the app's lifecycle a faked device location was noticed.
 *
 * `post_login` is the one the fraud rule turns on: readiness is evaluated the
 * moment a session exists, so a field executive who logs in with a fake-GPS app
 * already running is reported before they can touch a case.
 */
export type MockLocationDetectionStage =
  | 'post_login'
  | 'app_resume'
  | 'manual_recheck'
  | 'photo_capture';

/**
 * The position the mock provider claimed.
 *
 * Elsewhere coordinates are business evidence that never leaves the device
 * except with a capture; here they are the fraud evidence itself — the fake
 * position is precisely what the back office needs to see.
 */
export interface MockLocationDetectionFix {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAt: Date;
  readonly source: 'fresh' | 'lastKnown';
}

/** Handset identity captured with the detection, so a device can be traced. */
export interface MockLocationDeviceContext {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly manufacturer: string;
  readonly deviceType: string;
  readonly systemName: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly appBuildNumber: string;
  readonly installerPackageName: string;
  readonly isEmulator: boolean;
  readonly timeZone: string;
}

/** One detection, as reported to the back office. */
export interface MockLocationDetection {
  /**
   * Device-generated id, kept for the life of the report — a detection queued
   * while offline is retried under the same id, so the server records it once.
   */
  readonly clientEventId: string;
  readonly detectionStage: MockLocationDetectionStage;
  readonly detectedAt: Date;
  readonly fix: MockLocationDetectionFix | null;
  readonly caseId: string | null;
  readonly device: MockLocationDeviceContext;
}

/** The back office's acknowledgement of a reported detection. */
export interface MockLocationDetectionReceipt {
  readonly eventId: string;
  /** True when this detection had already been recorded — the retry was a no-op. */
  readonly isDuplicate: boolean;
  readonly reportedAt: string;
  /** Detections standing against this field executive, this one included. */
  readonly totalDetectionCount: number;
  readonly firstDetectedAt: string | null;
}
