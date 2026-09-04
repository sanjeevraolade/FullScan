import { getDb } from './connection.js';
import type { MockLocationEventInsert, MockLocationEventRow } from '../types/mock-location.types.js';

export function findMockLocationEventByClientEventId(
  clientEventId: string,
): MockLocationEventRow | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM mock_location_events WHERE client_event_id = ?')
    .get(clientEventId) as MockLocationEventRow | undefined;
}

export function insertMockLocationEvent(event: MockLocationEventInsert): MockLocationEventRow {
  const db = getDb();

  db.prepare(
    `INSERT INTO mock_location_events (
       id, client_event_id, field_executive_id,
       detection_stage, detected_at,
       latitude, longitude, accuracy_meters, fix_captured_at, fix_source,
       case_id,
       device_id, device_name, device_model, device_brand, device_manufacturer, device_type,
       os_name, os_version, app_version, app_build_number, installer_package_name,
       is_emulator, device_time_zone,
       raw_payload
     ) VALUES (
       @id, @clientEventId, @fieldExecutiveId,
       @detectionStage, @detectedAt,
       @latitude, @longitude, @accuracyMeters, @fixCapturedAt, @fixSource,
       @caseId,
       @deviceId, @deviceName, @deviceModel, @deviceBrand, @deviceManufacturer, @deviceType,
       @osName, @osVersion, @appVersion, @appBuildNumber, @installerPackageName,
       @isEmulator, @deviceTimeZone,
       @rawPayload
     )`,
  ).run({
    ...event,
    // better-sqlite3 binds integers, not booleans.
    isEmulator: event.isEmulator ? 1 : 0,
  });

  return db.prepare('SELECT * FROM mock_location_events WHERE id = ?').get(event.id) as
    MockLocationEventRow;
}

/** How many detections stand against this executive — the fraud signal the report returns. */
export function countMockLocationEventsForFieldExecutive(fieldExecutiveId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM mock_location_events WHERE field_executive_id = ?')
    .get(fieldExecutiveId) as { total: number };
  return row.total;
}

/** Device clock of the earliest detection, so the back office can see how long this has run. */
export function findFirstDetectedAtForFieldExecutive(fieldExecutiveId: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT MIN(detected_at) AS first_detected_at FROM mock_location_events WHERE field_executive_id = ?',
    )
    .get(fieldExecutiveId) as { first_detected_at: string | null };
  return row.first_detected_at;
}
