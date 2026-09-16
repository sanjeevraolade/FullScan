export type DeviceChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type DeviceReleaseReason = 'device_change_approved' | 'binding_replaced';

export interface DeviceView {
  readonly deviceId: string;
  readonly deviceName: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly systemName: string | null;
  readonly osVersion: string | null;
  readonly appVersion: string | null;
}

export interface DeviceAfterChange extends DeviceView {
  readonly boundAt: string | null;
  readonly lastLoginAt: string | null;
}

export interface AdminDeviceChangeRequest {
  readonly id: string;
  readonly status: DeviceChangeRequestStatus;
  readonly reason: string | null;
  readonly requestedAt: string;
  readonly deviceAtRequest: DeviceView;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly newDevice: DeviceAfterChange | null;
  readonly fieldExecutive: { readonly id: string; readonly name: string; readonly username: string };
  readonly decidedBy: { readonly id: string; readonly name: string } | null;
}

export interface DeviceChangeRequestCounts {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly all: number;
}

export interface AdminDeviceChangeRequestList {
  readonly items: readonly AdminDeviceChangeRequest[];
  readonly counts: DeviceChangeRequestCounts;
}

export type DeviceChangeStatusFilter = DeviceChangeRequestStatus | 'all';

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
