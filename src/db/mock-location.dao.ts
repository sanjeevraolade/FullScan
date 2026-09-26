import { getCollection, sessionOption } from './connection.js';
import { fromDocument, type StoredDocument } from './documents.js';
import { nowTimestamp } from './timestamp.js';
import type { MockLocationEventInsert, MockLocationEventRow } from '../types/mock-location.types.js';

type MockLocationEventDocument = StoredDocument<MockLocationEventRow>;

function mockLocationEvents() {
  return getCollection<MockLocationEventDocument>('mock_location_events');
}

export async function findMockLocationEventByClientEventId(
  clientEventId: string,
): Promise<MockLocationEventRow | undefined> {
  const document = await mockLocationEvents().findOne({ client_event_id: clientEventId }, sessionOption());
  return document ? fromDocument<MockLocationEventRow>(document) : undefined;
}

export async function insertMockLocationEvent(event: MockLocationEventInsert): Promise<MockLocationEventRow> {
  const now = nowTimestamp();
  const document: MockLocationEventDocument = {
    _id: event.id,
    client_event_id: event.clientEventId,
    field_executive_id: event.fieldExecutiveId,
    detection_stage: event.detectionStage,
    detected_at: event.detectedAt,
    reported_at: now,
    latitude: event.latitude,
    longitude: event.longitude,
    accuracy_meters: event.accuracyMeters,
    fix_captured_at: event.fixCapturedAt,
    fix_source: event.fixSource,
    case_id: event.caseId,
    device_id: event.deviceId,
    device_name: event.deviceName,
    device_model: event.deviceModel,
    device_brand: event.deviceBrand,
    device_manufacturer: event.deviceManufacturer,
    device_type: event.deviceType,
    os_name: event.osName,
    os_version: event.osVersion,
    app_version: event.appVersion,
    app_build_number: event.appBuildNumber,
    installer_package_name: event.installerPackageName,
    // Kept as 0/1, the form the SQLite column held and the services compare against.
    is_emulator: event.isEmulator ? 1 : 0,
    device_time_zone: event.deviceTimeZone,
    raw_payload: event.rawPayload,
    created_at: now,
  };

  await mockLocationEvents().insertOne(document, sessionOption());
  return fromDocument<MockLocationEventRow>(document);
}

/** How many detections stand against this executive — the fraud signal the report returns. */
export function countMockLocationEventsForFieldExecutive(fieldExecutiveId: string): Promise<number> {
  return mockLocationEvents().countDocuments({ field_executive_id: fieldExecutiveId }, sessionOption());
}

/** Device clock of the earliest detection, so the back office can see how long this has run. */
export async function findFirstDetectedAtForFieldExecutive(fieldExecutiveId: string): Promise<string | null> {
  const earliest = await mockLocationEvents().findOne(
    { field_executive_id: fieldExecutiveId },
    { sort: { detected_at: 1 }, projection: { detected_at: 1 }, ...sessionOption() },
  );
  return earliest?.detected_at ?? null;
}
