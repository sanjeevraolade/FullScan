import type { CaseBucket } from './cases';
import type { AdminDeviceChangeRequest, DeviceHistoryEntry } from './device-change';

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

export interface MockLocationHistoryEvent {
  readonly id: string;
  readonly detectionStage: string;
  readonly detectedAt: string;
  readonly reportedAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly fixCapturedAt: string | null;
  readonly fixSource: string | null;
  readonly device: MockLocationEventDevice;
}

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
  readonly distinctDeviceCount: number;
}

export interface FieldExecutiveHistory {
  readonly fieldExecutive: AdminFieldExecutiveListItem;
  readonly summary: FieldExecutiveHistorySummary;
  readonly caseGroups: readonly FieldExecutiveCaseGroup[];
  readonly unlinkedMockLocationEvents: readonly MockLocationHistoryEvent[];
  readonly deviceHistory: readonly DeviceHistoryEntry[];
  readonly deviceChangeRequests: readonly AdminDeviceChangeRequest[];
}
