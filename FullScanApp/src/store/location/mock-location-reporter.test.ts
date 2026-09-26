import { KeyValueStorageService } from '@/infrastructure/storage';
import { reportMockLocationDetection } from '@/repositories/security-repository';
import type { DeviceLocation } from '@/infrastructure/location';
import type { MockLocationDetection } from '@/domain/security';

import {
  flushPendingMockLocationReports,
  recordMockLocationDetection,
  resetMockLocationReportThrottle,
} from './mock-location-reporter';

jest.mock('@/repositories/security-repository', () => ({
  reportMockLocationDetection: jest.fn(),
}));

const PENDING_REPORTS_STORAGE_KEY = 'security:pendingMockLocationReports';

const MOCKED_FIX: DeviceLocation = {
  latitude: 17.4452,
  longitude: 78.3821,
  accuracyMeters: 5,
  isMockLocation: true,
  capturedAt: new Date('2026-09-05T06:29:58.000Z'),
  source: 'fresh',
};

function buildReceipt(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    eventId: 'evt-1',
    isDuplicate: false,
    reportedAt: '2026-09-05 06:30:01',
    totalDetectionCount: 1,
    firstDetectedAt: '2026-09-05T06:30:00.000Z',
    ...overrides,
  };
}

/** An axios-shaped failure: `response` present means the server answered. */
function buildHttpError(status: number): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  });
}

interface QueuedReport {
  readonly clientEventId: string;
  readonly detectionStage: string;
}

function readQueue(): readonly QueuedReport[] {
  return KeyValueStorageService.getObject<QueuedReport[]>(PENDING_REPORTS_STORAGE_KEY) ?? [];
}

function readFirstQueued(): QueuedReport {
  const [queued] = readQueue();

  if (!queued) {
    throw new Error('Expected a queued mock-location report');
  }

  return queued;
}

/** The detection handed to the repository on the nth report. */
function readReportedDetection(callIndex: number): MockLocationDetection {
  const call = jest.mocked(reportMockLocationDetection).mock.calls[callIndex];

  if (!call) {
    throw new Error(`Expected a mock-location report at call ${callIndex}`);
  }

  return call[0];
}

describe('mock-location-reporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    KeyValueStorageService.remove(PENDING_REPORTS_STORAGE_KEY);
    resetMockLocationReportThrottle();
    jest.mocked(reportMockLocationDetection).mockResolvedValue(buildReceipt() as never);
  });

  it('reports a post-login detection with the faked fix and the device context', async () => {
    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    expect(reportMockLocationDetection).toHaveBeenCalledTimes(1);
    const detection = readReportedDetection(0);

    expect(detection.detectionStage).toBe('post_login');
    expect(detection.clientEventId).toMatch(/^mock-/);
    // The fake coordinates are the evidence — they are reported, not withheld.
    expect(detection.fix).toMatchObject({
      latitude: MOCKED_FIX.latitude,
      longitude: MOCKED_FIX.longitude,
      accuracyMeters: MOCKED_FIX.accuracyMeters,
      source: 'fresh',
    });
    expect(detection.device).toMatchObject({
      deviceId: 'test-unique-id',
      model: 'test-model',
      manufacturer: 'test-manufacturer',
      systemName: 'Android',
      appVersion: '1.0.0',
      appBuildNumber: '100',
      installerPackageName: 'com.android.vending',
      isEmulator: false,
    });
  });

  it('carries the case a blocked capture was targeting', async () => {
    await recordMockLocationDetection({
      detectionStage: 'photo_capture',
      location: MOCKED_FIX,
      caseId: 'case-1001',
      isRepeatDetection: false,
    });

    expect(readReportedDetection(0).caseId).toBe('case-1001');
  });

  it('clears the queue once a report is delivered', async () => {
    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    expect(readQueue()).toHaveLength(0);
  });

  it('does not re-report the same episode within the cooldown', async () => {
    await recordMockLocationDetection({
      detectionStage: 'app_resume',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });
    await recordMockLocationDetection({
      detectionStage: 'app_resume',
      location: MOCKED_FIX,
      isRepeatDetection: true,
    });

    expect(reportMockLocationDetection).toHaveBeenCalledTimes(1);
  });

  it('still reports a blocked capture during an episode already reported on resume', async () => {
    await recordMockLocationDetection({
      detectionStage: 'app_resume',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });
    await recordMockLocationDetection({
      detectionStage: 'photo_capture',
      location: MOCKED_FIX,
      isRepeatDetection: true,
    });

    expect(reportMockLocationDetection).toHaveBeenCalledTimes(2);
    expect(readReportedDetection(1).detectionStage).toBe('photo_capture');
  });

  it('reports again after a new session clears the throttle', async () => {
    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });
    resetMockLocationReportThrottle();
    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: true,
    });

    expect(reportMockLocationDetection).toHaveBeenCalledTimes(2);
  });

  it('keeps a detection queued when the device is offline, and delivers it on the next flush', async () => {
    jest
      .mocked(reportMockLocationDetection)
      .mockRejectedValueOnce(new Error('Network Error'));

    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    const queued = readFirstQueued();
    expect(readQueue()).toHaveLength(1);
    expect(queued.detectionStage).toBe('post_login');

    await flushPendingMockLocationReports();

    expect(reportMockLocationDetection).toHaveBeenCalledTimes(2);
    // The retry re-uses the same client event id, so the server records it once.
    expect(readReportedDetection(1).clientEventId).toBe(queued.clientEventId);
    expect(readQueue()).toHaveLength(0);
  });

  it('keeps a detection queued when the server fails', async () => {
    jest.mocked(reportMockLocationDetection).mockRejectedValueOnce(buildHttpError(503));

    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    expect(readQueue()).toHaveLength(1);
  });

  it('drops a detection the server rejected outright, so the queue cannot wedge', async () => {
    jest.mocked(reportMockLocationDetection).mockRejectedValueOnce(buildHttpError(400));

    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    expect(readQueue()).toHaveLength(0);
  });

  it('keeps a detection queued when the session token was not accepted', async () => {
    jest.mocked(reportMockLocationDetection).mockRejectedValueOnce(buildHttpError(401));

    await recordMockLocationDetection({
      detectionStage: 'post_login',
      location: MOCKED_FIX,
      isRepeatDetection: false,
    });

    expect(readQueue()).toHaveLength(1);
  });

  it('reports a detection that has no usable fix', async () => {
    await recordMockLocationDetection({
      detectionStage: 'app_resume',
      location: null,
      isRepeatDetection: false,
    });

    expect(readReportedDetection(0).fix).toBeNull();
  });

  it('flushes nothing when the queue is empty', async () => {
    await flushPendingMockLocationReports();

    expect(reportMockLocationDetection).not.toHaveBeenCalled();
  });
});
