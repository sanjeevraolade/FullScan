import * as adminFieldExecutiveDao from '../db/admin-field-executive.dao.js';
import { getDeviceRecordsForAdmin } from './device-change.service.js';
import { AppError } from '../utils/app-error.js';
import type { CaseBucket } from '../types/case.types.js';
import type { MockLocationEventRow } from '../types/mock-location.types.js';
import type {
  AdminFieldExecutiveListItem,
  FieldExecutiveCaseGroup,
  FieldExecutiveCaseHistory,
  FieldExecutiveComponentRow,
  FieldExecutiveHistory,
  MockLocationHistoryEvent,
  AdminFieldExecutiveRow,
} from '../types/admin-field-executive.types.js';

/**
 * Field executive history for the back office.
 *
 * Mock-location detections are the only per-executive audit trail the platform
 * keeps today, and they carry the component that was open when the fake fix was
 * seen — so history reads case-wise: each case the executive holds, and what was
 * detected while they were on it.
 */

function mapFieldExecutive(row: AdminFieldExecutiveRow): AdminFieldExecutiveListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    username: row.username,
    isDeviceBound: Boolean(row.device_id),
    assignedComponentCount: row.assigned_component_count,
    mockLocationEventCount: row.mock_location_event_count,
    lastMockLocationDetectedAt: row.last_mock_location_detected_at,
  };
}

function mapEvent(row: MockLocationEventRow): MockLocationHistoryEvent {
  return {
    id: row.id,
    detectionStage: row.detection_stage,
    detectedAt: row.detected_at,
    reportedAt: row.reported_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    fixCapturedAt: row.fix_captured_at,
    fixSource: row.fix_source,
    device: {
      deviceId: row.device_id,
      deviceName: row.device_name,
      model: row.device_model,
      brand: row.device_brand,
      manufacturer: row.device_manufacturer,
      deviceType: row.device_type,
      osName: row.os_name,
      osVersion: row.os_version,
      appVersion: row.app_version,
      appBuildNumber: row.app_build_number,
      installerPackageName: row.installer_package_name,
      isEmulator: row.is_emulator === 1,
      timeZone: row.device_time_zone,
    },
  };
}

function mapCase(
  component: FieldExecutiveComponentRow,
  events: readonly MockLocationHistoryEvent[],
): FieldExecutiveCaseHistory {
  return {
    componentId: component.id,
    caseId: component.case_id,
    caseRef: component.case_ref,
    clientName: component.client_name,
    candidateName: component.candidate_name,
    verificationType: component.verification_type,
    addressType: component.address_type,
    address: component.address,
    bucket: component.bucket,
    componentStatus: component.component_status,
    actionStatus: component.action_status,
    tatDueAt: component.tat_due_at,
    updatedAt: component.updated_at,
    mockLocationEvents: events,
  };
}

/** Stored timestamps sort correctly as strings; a missing one sorts last. */
function compareTimestampsDesc(left: string | null, right: string | null): number {
  return (right ?? '').localeCompare(left ?? '');
}

/** Cases with detections first, then by most recent activity — a review starts at the signal. */
function compareCaseHistoryDesc(
  left: FieldExecutiveCaseHistory,
  right: FieldExecutiveCaseHistory,
): number {
  if (left.mockLocationEvents.length !== right.mockLocationEvents.length) {
    return right.mockLocationEvents.length - left.mockLocationEvents.length;
  }
  return compareTimestampsDesc(left.updatedAt, right.updatedAt);
}

/**
 * The categories that always get their own headed list, in display order.
 *
 * `new` is not one of them: a New component is an unclaimed entry in the shared
 * pool rather than work this executive has done. It is already filtered out of
 * the assigned-components query, so it can only reach here attached to a
 * detection — and evidence is never dropped, so that one case gets a group too,
 * appended after the standard three.
 */
const HISTORY_BUCKETS: readonly CaseBucket[] = ['pending', 'beyond_tat', 'completed'];

function buildGroup(
  bucket: CaseBucket,
  cases: readonly FieldExecutiveCaseHistory[],
): FieldExecutiveCaseGroup {
  const inBucket = cases.filter((entry) => entry.bucket === bucket).sort(compareCaseHistoryDesc);

  return {
    bucket,
    caseCount: inBucket.length,
    mockLocationEventCount: inBucket.reduce(
      (total, entry) => total + entry.mockLocationEvents.length,
      0,
    ),
    cases: inBucket,
  };
}

/**
 * One group per category. The standard three are always present — an empty
 * Pending list is itself an answer — and any further bucket (in practice only
 * `new`, carrying a detection) is appended after them.
 */
function groupCasesByBucket(
  cases: readonly FieldExecutiveCaseHistory[],
): FieldExecutiveCaseGroup[] {
  const extraBuckets = [
    ...new Set(cases.map((entry) => entry.bucket).filter((bucket) => !HISTORY_BUCKETS.includes(bucket))),
  ];

  return [...HISTORY_BUCKETS, ...extraBuckets].map((bucket) => buildGroup(bucket, cases));
}

export async function listFieldExecutivesForAdmin(search?: string): Promise<AdminFieldExecutiveListItem[]> {
  return (await adminFieldExecutiveDao.findFieldExecutivesForAdmin(search)).map(mapFieldExecutive);
}

/**
 * One executive's case-wise history, as one headed list per workflow category.
 *
 * Detections against a component the executive no longer holds still surface:
 * the component is pulled in by id and listed alongside the assigned ones, so
 * reassigning a case cannot hide where a fake fix was reported.
 */
export async function getFieldExecutiveHistory(fieldExecutiveId: string): Promise<FieldExecutiveHistory> {
  const row = await adminFieldExecutiveDao.findFieldExecutiveForAdmin(fieldExecutiveId);

  if (!row) {
    throw new AppError(404, `Field executive not found: ${fieldExecutiveId}`);
  }

  const [eventRows, assignedComponents, distinctDeviceCount, deviceRecords] = await Promise.all([
    adminFieldExecutiveDao.findMockLocationEventsForFieldExecutive(fieldExecutiveId),
    adminFieldExecutiveDao.findComponentsAssignedToFieldExecutive(fieldExecutiveId),
    adminFieldExecutiveDao.countDistinctMockLocationDevices(fieldExecutiveId),
    getDeviceRecordsForAdmin(fieldExecutiveId),
  ]);

  const componentsById = new Map<string, FieldExecutiveComponentRow>(
    assignedComponents.map((component) => [component.id, component]),
  );

  // Components named by a detection but no longer assigned here.
  const referencedElsewhere = [
    ...new Set(
      eventRows
        .map((event) => event.case_id)
        .filter((componentId): componentId is string => componentId !== null)
        .filter((componentId) => !componentsById.has(componentId)),
    ),
  ];

  for (const component of await adminFieldExecutiveDao.findComponentsByIds(referencedElsewhere)) {
    componentsById.set(component.id, component);
  }

  const eventsByComponentId = new Map<string, MockLocationHistoryEvent[]>();
  const unlinkedMockLocationEvents: MockLocationHistoryEvent[] = [];

  for (const eventRow of eventRows) {
    const event = mapEvent(eventRow);
    const componentId = eventRow.case_id;

    if (!componentId || !componentsById.has(componentId)) {
      unlinkedMockLocationEvents.push(event);
      continue;
    }

    const bucket = eventsByComponentId.get(componentId) ?? [];
    bucket.push(event);
    eventsByComponentId.set(componentId, bucket);
  }

  const cases = [...componentsById.values()].map((component) =>
    mapCase(component, eventsByComponentId.get(component.id) ?? []),
  );

  return {
    fieldExecutive: mapFieldExecutive(row),
    summary: {
      assignedComponentCount: row.assigned_component_count,
      mockLocationEventCount: row.mock_location_event_count,
      // Rows come back newest-first, so the ends of the list are the extremes.
      firstDetectedAt: eventRows.length > 0 ? eventRows[eventRows.length - 1].detected_at : null,
      lastDetectedAt: eventRows.length > 0 ? eventRows[0].detected_at : null,
      distinctDeviceCount,
    },
    caseGroups: groupCasesByBucket(cases),
    unlinkedMockLocationEvents,
    // Every phone the account has been bound to and every device change request — never deleted.
    ...deviceRecords,
  };
}
