/** Where in the app's lifecycle the mocked location was noticed. */
export type MockLocationDetectionStage =
  | 'post_login'
  | 'app_resume'
  | 'manual_recheck'
  | 'photo_capture';

/** Handset identity captured alongside the detection. */
export interface MockLocationDeviceContext {
  readonly deviceId?: string;
  readonly deviceName?: string;
  readonly model?: string;
  readonly brand?: string;
  readonly manufacturer?: string;
  readonly deviceType?: string;
  readonly systemName?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly appBuildNumber?: string;
  readonly installerPackageName?: string;
  readonly isEmulator?: boolean;
  readonly timeZone?: string;
}

/** The coordinates the mock provider claimed — evidence, not a usable position. */
export interface MockLocationFix {
  readonly latitude?: number;
  readonly longitude?: number;
  readonly accuracyMeters?: number;
  readonly capturedAt?: string;
  readonly source?: 'fresh' | 'lastKnown';
}

/** Body of POST /api/v1/security/mock-location. */
export interface MockLocationReportInput {
  readonly clientEventId: string;
  readonly detectionStage: MockLocationDetectionStage;
  readonly detectedAt: string;
  readonly fix?: MockLocationFix;
  readonly caseId?: string;
  readonly device?: MockLocationDeviceContext;
}

/** What the app gets back — enough to confirm the report landed, nothing more. */
export interface MockLocationReportResult {
  readonly eventId: string;
  /** True when this `clientEventId` had already been recorded — the retry was a no-op. */
  readonly isDuplicate: boolean;
  readonly reportedAt: string;
  /** Total detections recorded against this field executive, this one included. */
  readonly totalEventCount: number;
  readonly firstDetectedAt: string | null;
}

export interface MockLocationEventRow {
  readonly id: string;
  readonly client_event_id: string;
  readonly field_executive_id: string;
  readonly detection_stage: string;
  readonly detected_at: string;
  readonly reported_at: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracy_meters: number | null;
  readonly fix_captured_at: string | null;
  readonly fix_source: string | null;
  readonly case_id: string | null;
  readonly device_id: string | null;
  readonly device_name: string | null;
  readonly device_model: string | null;
  readonly device_brand: string | null;
  readonly device_manufacturer: string | null;
  readonly device_type: string | null;
  readonly os_name: string | null;
  readonly os_version: string | null;
  readonly app_version: string | null;
  readonly app_build_number: string | null;
  readonly installer_package_name: string | null;
  readonly is_emulator: number;
  readonly device_time_zone: string | null;
  readonly raw_payload: string;
  readonly created_at: string;
}

/** Row shape for an insert — every column the app can populate. */
export interface MockLocationEventInsert {
  readonly id: string;
  readonly clientEventId: string;
  readonly fieldExecutiveId: string;
  readonly detectionStage: string;
  readonly detectedAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly fixCapturedAt: string | null;
  readonly fixSource: string | null;
  readonly caseId: string | null;
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly deviceModel: string | null;
  readonly deviceBrand: string | null;
  readonly deviceManufacturer: string | null;
  readonly deviceType: string | null;
  readonly osName: string | null;
  readonly osVersion: string | null;
  readonly appVersion: string | null;
  readonly appBuildNumber: string | null;
  readonly installerPackageName: string | null;
  readonly isEmulator: boolean;
  readonly deviceTimeZone: string | null;
  readonly rawPayload: string;
}
