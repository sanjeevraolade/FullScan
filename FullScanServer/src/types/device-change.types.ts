import type { DeviceView } from './device.types.js';

export const DEVICE_CHANGE_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DeviceChangeRequestStatus = (typeof DEVICE_CHANGE_REQUEST_STATUSES)[number];

/** Why a device binding was closed. */
export type DeviceReleaseReason = 'device_change_approved' | 'binding_replaced';

/* ------------------------------------------------------------------ rows */

/** `device_change_requests` joined with its executive, deciding admin and the binding that followed it. */
export interface DeviceChangeRequestDetailRow {
  readonly id: string;
  readonly field_executive_id: string;
  readonly status: DeviceChangeRequestStatus;
  readonly reason: string | null;
  readonly device_id: string;
  readonly device_details: string | null;
  readonly requested_at: string;
  readonly decided_at: string | null;
  readonly decided_by: string | null;
  readonly decision_note: string | null;
  readonly fe_name: string;
  readonly fe_username: string;
  readonly decided_by_name: string | null;
  readonly new_device_id: string | null;
  readonly new_device_details: string | null;
  readonly new_bound_at: string | null;
  readonly new_last_login_at: string | null;
}

/** Raw `field_executive_devices` row. */
export interface FieldExecutiveDeviceRow {
  readonly id: string;
  readonly field_executive_id: string;
  readonly device_id: string;
  readonly device_details: string | null;
  readonly bound_at: string | null;
  readonly last_login_at: string | null;
  readonly released_at: string | null;
  readonly release_reason: DeviceReleaseReason | null;
  readonly released_by_request_id: string | null;
  readonly bound_after_request_id: string | null;
  readonly created_at: string;
}

/* ----------------------------------------------------------------- views */

export interface DeviceChangePolicy {
  /** `device_change_max_requests` */
  readonly maxRequests: number;
  /** `device_change_window_days` */
  readonly windowDays: number;
}

export type DeviceChangeBlockedReason = 'no_device' | 'pending_request' | 'limit_reached';

export interface DeviceChangeEligibility {
  readonly policy: DeviceChangePolicy;
  /** Requests submitted in the last `windowDays` days, any status. */
  readonly requestsInWindow: number;
  readonly canRequest: boolean;
  readonly blockedReason: DeviceChangeBlockedReason | null;
  /** When `limit_reached`: the moment the oldest counted request leaves the window. */
  readonly nextRequestAllowedAt: string | null;
}

/** The binding made after an approved request — "the new device". */
export interface DeviceAfterChange extends DeviceView {
  readonly boundAt: string | null;
  readonly lastLoginAt: string | null;
}

/** A request as the field executive sees it. */
export interface DeviceChangeRequestView {
  readonly id: string;
  readonly status: DeviceChangeRequestStatus;
  readonly reason: string | null;
  readonly requestedAt: string;
  /** The phone that was bound when the request was made. */
  readonly deviceAtRequest: DeviceView;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  /** Only once approved and the FE has signed in to the app again. */
  readonly newDevice: DeviceAfterChange | null;
}

/** A request as an admin sees it — adds who it belongs to and who decided it. */
export interface AdminDeviceChangeRequest extends DeviceChangeRequestView {
  readonly fieldExecutive: { readonly id: string; readonly name: string; readonly username: string };
  readonly decidedBy: { readonly id: string; readonly name: string } | null;
}

export interface DeviceHistoryEntry {
  readonly id: string;
  readonly device: DeviceView;
  readonly boundAt: string | null;
  readonly lastLoginAt: string | null;
  readonly releasedAt: string | null;
  readonly releaseReason: DeviceReleaseReason | null;
  readonly releasedByRequestId: string | null;
  readonly boundAfterRequestId: string | null;
  readonly isCurrent: boolean;
}

export interface FieldExecutiveDeviceChangeOverview {
  readonly eligibility: DeviceChangeEligibility;
  /** Newest first. */
  readonly requests: readonly DeviceChangeRequestView[];
  /** Newest first. */
  readonly deviceHistory: readonly DeviceHistoryEntry[];
}

export interface DeviceChangeRequestCounts {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly all: number;
}

export interface AdminDeviceChangeRequestList {
  readonly items: readonly AdminDeviceChangeRequest[];
  /** Per status, ignoring the status filter (but honouring the executive filter). */
  readonly counts: DeviceChangeRequestCounts;
}

export interface DeviceChangeRequestFilter {
  readonly status?: DeviceChangeRequestStatus;
  readonly fieldExecutiveId?: string;
}

/** Device records for one executive, as shown on the admin's Field Executive History page. */
export interface AdminFieldExecutiveDeviceRecords {
  readonly deviceHistory: readonly DeviceHistoryEntry[];
  readonly deviceChangeRequests: readonly AdminDeviceChangeRequest[];
}
