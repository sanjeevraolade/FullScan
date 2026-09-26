import { v4 as uuidv4 } from 'uuid';

import * as mockLocationDao from '../db/mock-location.dao.js';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import type {
  MockLocationReportInput,
  MockLocationReportResult,
} from '../types/mock-location.types.js';

function toNullableNumber(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

function toNullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Records one mock-location detection reported by the mobile app.
 *
 * Idempotent on `clientEventId`: the app queues a report it could not send
 * while offline and retries it later, so the same detection can arrive more
 * than once. A repeat is answered with the original event rather than an error,
 * which is what lets the app drop it from its queue.
 */
export async function reportMockLocationEvent(
  fieldExecutiveId: string,
  input: MockLocationReportInput,
): Promise<MockLocationReportResult> {
  const fieldExecutive = await fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);

  if (!fieldExecutive) {
    throw new AppError(404, 'No field executive session found');
  }

  const existing = await mockLocationDao.findMockLocationEventByClientEventId(input.clientEventId);

  if (existing) {
    logger.warn(
      { fieldExecutiveId, clientEventId: input.clientEventId, eventId: existing.id },
      'Mock location report re-delivered — already recorded',
    );

    return {
      eventId: existing.id,
      isDuplicate: true,
      reportedAt: existing.reported_at,
      totalEventCount: await mockLocationDao.countMockLocationEventsForFieldExecutive(fieldExecutiveId),
      firstDetectedAt: await mockLocationDao.findFirstDetectedAtForFieldExecutive(fieldExecutiveId),
    };
  }

  const fix = input.fix ?? {};
  const device = input.device ?? {};

  const row = await mockLocationDao.insertMockLocationEvent({
    id: uuidv4(),
    clientEventId: input.clientEventId,
    fieldExecutiveId,
    detectionStage: input.detectionStage,
    detectedAt: input.detectedAt,
    latitude: toNullableNumber(fix.latitude),
    longitude: toNullableNumber(fix.longitude),
    accuracyMeters: toNullableNumber(fix.accuracyMeters),
    fixCapturedAt: toNullableText(fix.capturedAt),
    fixSource: toNullableText(fix.source),
    caseId: toNullableText(input.caseId),
    deviceId: toNullableText(device.deviceId),
    deviceName: toNullableText(device.deviceName),
    deviceModel: toNullableText(device.model),
    deviceBrand: toNullableText(device.brand),
    deviceManufacturer: toNullableText(device.manufacturer),
    deviceType: toNullableText(device.deviceType),
    osName: toNullableText(device.systemName),
    osVersion: toNullableText(device.osVersion),
    appVersion: toNullableText(device.appVersion),
    appBuildNumber: toNullableText(device.appBuildNumber),
    installerPackageName: toNullableText(device.installerPackageName),
    isEmulator: device.isEmulator ?? false,
    deviceTimeZone: toNullableText(device.timeZone),
    // Verbatim, so a field a newer app build sends is kept even before the
    // schema knows about it.
    rawPayload: JSON.stringify(input),
  });

  const totalEventCount =
    await mockLocationDao.countMockLocationEventsForFieldExecutive(fieldExecutiveId);

  // A fraud signal belongs in the server log at warn level, not just the table.
  logger.warn(
    {
      fieldExecutiveId,
      eventId: row.id,
      detectionStage: input.detectionStage,
      detectedAt: input.detectedAt,
      deviceId: device.deviceId,
      isEmulator: device.isEmulator ?? false,
      totalEventCount,
    },
    'Mock location detected on a field executive device',
  );

  return {
    eventId: row.id,
    isDuplicate: false,
    reportedAt: row.reported_at,
    totalEventCount,
    firstDetectedAt: await mockLocationDao.findFirstDetectedAtForFieldExecutive(fieldExecutiveId),
  };
}
