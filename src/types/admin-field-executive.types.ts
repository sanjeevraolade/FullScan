import type { CaseBucket } from './case.types.js';
import type { AdminFieldExecutiveDeviceRecords } from './device-change.types.js';

/**
 * Admin-facing field executive types.
 *
 * The history endpoint answers one back-office question: *what has this
 * executive been doing, and did anything look fraudulent while they did it?*
 * Mock-location detections are therefore folded into the case they were
 * recorded against rather than presented as a separate flat log.
 */

/** One row in the admin's field executive picker. */
export interface AdminFieldExecutiveListItem {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly username: string;
  readonly isDeviceBound: boolean;
  readonly assignedComponentCount: number;
  readonly mockLocationEventCount: number;
  readonly lastMockLocationDetectedAt: string | null;
}

/** Handset identity captured with a detection — what ties a fake-GPS app to a device. */
export interface MockLocationEventDevice {
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly model: string | null;
  readonly brand: string | null;
  readonly manufacturer: string | null;
  readonly deviceType: string | null;
  readonly osName: string | null;
  readonly osVersion: string | null;
  readonly appVersion: string | null;
  readonly appBuildNumber: string | null;
  readonly installerPackageName: string | null;
  readonly isEmulator: boolean;
  readonly timeZone: string | null;
}

/** One mock-location detection, as the back office reads it. */
export interface MockLocationHistoryEvent {
  readonly id: string;
  readonly detectionStage: string;
  /** Device clock at detection — "mock enabled at". May itself be tampered with. */
  readonly detectedAt: string;
  /** Server clock when the report landed; a wide gap means it was queued offline. */
  readonly reportedAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly fixCapturedAt: string | null;
  readonly fixSource: string | null;
  readonly device: MockLocationEventDevice;
}

/** One case component the executive worked, with whatever was detected while on it. */
export interface FieldExecutiveCaseHistory {
  readonly componentId: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly componentStatus: string;
  readonly actionStatus: string | null;
  readonly tatDueAt: string;
  readonly updatedAt: string;
  readonly mockLocationEvents: readonly MockLocationHistoryEvent[];
}

/**
 * One workflow category's cases, rendered as its own headed list.
 *
 * `new` is deliberately not one of the standard groups: a New component is an
 * unclaimed entry in the shared pool, not work this executive has done, and the
 * mobile app itself re-draws that bucket at random on every request. It appears
 * here only in the one case where dropping it would hide evidence — when a
 * detection was recorded against it.
 */
export interface FieldExecutiveCaseGroup {
  readonly bucket: CaseBucket;
  readonly caseCount: number;
  readonly mockLocationEventCount: number;
  readonly cases: readonly FieldExecutiveCaseHistory[];
}

export interface FieldExecutiveHistorySummary {
  readonly assignedComponentCount: number;
  readonly mockLocationEventCount: number;
  readonly firstDetectedAt: string | null;
  readonly lastDetectedAt: string | null;
  /** Distinct handsets detections came from — more than one is itself a signal. */
  readonly distinctDeviceCount: number;
}

/** Also carries `deviceHistory` and `deviceChangeRequests` — see `device-change.types.ts`. */
export interface FieldExecutiveHistory extends AdminFieldExecutiveDeviceRecords {
  readonly fieldExecutive: AdminFieldExecutiveListItem;
  readonly summary: FieldExecutiveHistorySummary;
  /** One list per workflow category, in display order — Pending, Beyond TAT, Completed. */
  readonly caseGroups: readonly FieldExecutiveCaseGroup[];
  /**
   * Detections the app could not tie to a case — reported at login or on resume,
   * or against a component that no longer exists. Still evidence, so never dropped.
   */
  readonly unlinkedMockLocationEvents: readonly MockLocationHistoryEvent[];
}

/** Row shape for the field executive picker query. */
export interface AdminFieldExecutiveRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly username: string;
  readonly device_id: string | null;
  readonly assigned_component_count: number;
  readonly mock_location_event_count: number;
  readonly last_mock_location_detected_at: string | null;
}

/** Row shape for a component the executive is assigned, joined with its parent case. */
export interface FieldExecutiveComponentRow {
  readonly id: string;
  readonly case_id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly verification_type: string;
  readonly address_type: string | null;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly component_status: string;
  readonly action_status: string | null;
  readonly tat_due_at: string;
  readonly updated_at: string;
}
