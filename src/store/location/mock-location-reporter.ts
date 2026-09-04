import { LoggerService } from '@/infrastructure/logger';
import { KeyValueStorageService } from '@/infrastructure/storage';
import { getDeviceFraudContext } from '@/infrastructure/device';
import { reportMockLocationDetection } from '@/repositories/security-repository';
import type { DeviceLocation } from '@/infrastructure/location';
import type {
  MockLocationDetection,
  MockLocationDetectionStage,
  MockLocationDeviceContext,
} from '@/domain/security';

const FILE_NAME = 'mock-location-reporter.ts';

/**
 * Detections that have not reached the back office yet. Non-sensitive by the
 * storage rules — it holds a faked position and handset metadata, never a
 * token, a credential or candidate PII — so MMKV rather than the Keychain.
 */
const PENDING_REPORTS_STORAGE_KEY = 'security:pendingMockLocationReports';

/**
 * A device that stays offline with a fake-GPS app running would otherwise grow
 * this queue without limit. The oldest detections are dropped first: the
 * earliest one is already recorded server-side from the login report, and the
 * most recent ones are what an investigation acts on.
 */
const MAX_PENDING_REPORTS = 50;

/**
 * Readiness is re-evaluated on every app resume, so an executive who leaves a
 * fake-GPS app running would report the same episode over and over. One report
 * per episode, then at most one per this interval while it continues.
 *
 * Tracked per stage, not globally: a blocked evidence capture is a different
 * act from a fake GPS noticed on resume, and the capture attempt must still be
 * recorded even though the episode itself was reported minutes earlier.
 */
const REPEAT_DETECTION_COOLDOWN_MS = 15 * 60 * 1000;

/** HTTP statuses that mean "try again later" rather than "this payload is bad". */
const RETRYABLE_CLIENT_STATUSES: readonly number[] = [401, 408, 429];

let lastReportedAtMsByStage: Partial<Record<MockLocationDetectionStage, number>> = {};
/** Serializes flushes so a resume and a retry can't send the same queued report twice. */
let activeFlush: Promise<void> | null = null;

/** A queued detection, with dates flattened to ISO strings for storage. */
interface PendingMockLocationReport {
  readonly clientEventId: string;
  readonly detectionStage: MockLocationDetectionStage;
  readonly detectedAt: string;
  readonly fix: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
    readonly capturedAt: string;
    readonly source: 'fresh' | 'lastKnown';
  } | null;
  readonly caseId: string | null;
  readonly device: MockLocationDeviceContext;
}

export interface MockLocationDetectionInput {
  readonly detectionStage: MockLocationDetectionStage;
  /** The faked fix itself — evidence, so it is reported rather than discarded. */
  readonly location: DeviceLocation | null;
  /** Set when the detection happened while a case was open. */
  readonly caseId?: string | null;
  /** True when the previous evaluation had already found this same episode. */
  readonly isRepeatDetection: boolean;
}

/**
 * Identifies one detection for its whole life, including retries, so the
 * server records it exactly once. Randomness plus the device clock is enough:
 * collisions only matter within a single device's queue.
 */
function createClientEventId(): string {
  const clientEventId = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  LoggerService.info(`${FILE_NAME}: createClientEventId: generated a client event id`);
  return clientEventId;
}

/** HTTP status of a failed report, or `null` when the request never got a response. */
function resolveHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    LoggerService.info(`${FILE_NAME}: resolveHttpStatus: no response on the error — treating as transport failure`);
    return null;
  }

  const { response } = error as { response?: { status?: number } };
  const status = typeof response?.status === 'number' ? response.status : null;
  LoggerService.info(`${FILE_NAME}: resolveHttpStatus: resolved`, { status });
  return status;
}

/**
 * Whether a failed report should stay queued. Anything without a response
 * (offline, timeout) and any server error is retried; a payload the server
 * rejected outright is dropped, because retrying it forever would block the
 * queue behind it.
 */
function isRetryableFailure(error: unknown): boolean {
  const status = resolveHttpStatus(error);

  if (status === null) {
    LoggerService.warn(`${FILE_NAME}: isRetryableFailure: transport failure — keeping the report queued`);
    return true;
  }
  if (status >= 500) {
    LoggerService.warn(`${FILE_NAME}: isRetryableFailure: server error — keeping the report queued`, { status });
    return true;
  }
  if (RETRYABLE_CLIENT_STATUSES.includes(status)) {
    LoggerService.warn(`${FILE_NAME}: isRetryableFailure: retryable client error — keeping the report queued`, { status });
    return true;
  }

  LoggerService.error(`${FILE_NAME}: isRetryableFailure: report rejected — dropping it`, { status });
  return false;
}

function readPendingReports(): readonly PendingMockLocationReport[] {
  const pending = KeyValueStorageService.getObject<PendingMockLocationReport[]>(
    PENDING_REPORTS_STORAGE_KEY,
  );

  if (!pending || !Array.isArray(pending)) {
    LoggerService.info(`${FILE_NAME}: readPendingReports: no queued reports`);
    return [];
  }

  LoggerService.info(`${FILE_NAME}: readPendingReports: queued reports read`, {
    count: pending.length,
  });
  return pending;
}

function writePendingReports(reports: readonly PendingMockLocationReport[]): void {
  if (reports.length === 0) {
    LoggerService.info(`${FILE_NAME}: writePendingReports: queue emptied`);
    KeyValueStorageService.remove(PENDING_REPORTS_STORAGE_KEY);
    return;
  }

  LoggerService.info(`${FILE_NAME}: writePendingReports: queue written`, { count: reports.length });
  KeyValueStorageService.setObject(PENDING_REPORTS_STORAGE_KEY, reports);
}

function enqueuePendingReport(report: PendingMockLocationReport): void {
  const pending = [...readPendingReports(), report];
  const trimmed = pending.slice(-MAX_PENDING_REPORTS);

  if (trimmed.length < pending.length) {
    LoggerService.warn(`${FILE_NAME}: enqueuePendingReport: queue full — dropped the oldest reports`, {
      droppedCount: pending.length - trimmed.length,
      maxPendingReports: MAX_PENDING_REPORTS,
    });
  }

  writePendingReports(trimmed);
  LoggerService.warn(`${FILE_NAME}: enqueuePendingReport: detection queued for delivery`, {
    detectionStage: report.detectionStage,
    queuedCount: trimmed.length,
  });
}

function toDetection(report: PendingMockLocationReport): MockLocationDetection {
  LoggerService.info(`${FILE_NAME}: toDetection: reviving a queued report`, {
    detectionStage: report.detectionStage,
  });

  return {
    clientEventId: report.clientEventId,
    detectionStage: report.detectionStage,
    detectedAt: new Date(report.detectedAt),
    fix: report.fix
      ? {
          latitude: report.fix.latitude,
          longitude: report.fix.longitude,
          accuracyMeters: report.fix.accuracyMeters,
          capturedAt: new Date(report.fix.capturedAt),
          source: report.fix.source,
        }
      : null,
    caseId: report.caseId,
    device: report.device,
  };
}

async function deliverPendingReports(): Promise<void> {
  const pending = readPendingReports();

  if (pending.length === 0) {
    LoggerService.info(`${FILE_NAME}: deliverPendingReports: nothing to deliver`);
    return;
  }

  LoggerService.warn(`${FILE_NAME}: deliverPendingReports: delivering queued detections`, {
    count: pending.length,
  });

  let remaining = [...pending];

  for (const report of pending) {
    try {
      const receipt = await reportMockLocationDetection(toDetection(report));
      remaining = remaining.filter((queued) => queued.clientEventId !== report.clientEventId);
      writePendingReports(remaining);
      LoggerService.warn(`${FILE_NAME}: deliverPendingReports: detection delivered`, {
        detectionStage: report.detectionStage,
        isDuplicate: receipt.isDuplicate,
        totalDetectionCount: receipt.totalDetectionCount,
        remainingCount: remaining.length,
      });
    } catch (error: unknown) {
      if (!isRetryableFailure(error)) {
        remaining = remaining.filter((queued) => queued.clientEventId !== report.clientEventId);
        writePendingReports(remaining);
        LoggerService.error(`${FILE_NAME}: deliverPendingReports: detection dropped by the server`, {
          detectionStage: report.detectionStage,
          remainingCount: remaining.length,
        });
        continue;
      }

      // Offline or a server-side failure: everything still queued waits for the
      // next evaluation rather than being retried in a tight loop here.
      LoggerService.warn(`${FILE_NAME}: deliverPendingReports: delivery postponed`, {
        remainingCount: remaining.length,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  LoggerService.info(`${FILE_NAME}: deliverPendingReports: queue drained`);
}

/**
 * Sends anything still queued. Safe to call on every readiness evaluation:
 * it costs one storage read when the queue is empty, and it is what gets a
 * detection captured offline to the back office once the device reconnects.
 *
 * Never rejects — a failed delivery leaves the report queued.
 */
export async function flushPendingMockLocationReports(): Promise<void> {
  if (activeFlush) {
    LoggerService.info(`${FILE_NAME}: flushPendingMockLocationReports: a flush is already running`);
    await activeFlush;
    return;
  }

  LoggerService.info(`${FILE_NAME}: flushPendingMockLocationReports: starting a flush`);
  activeFlush = deliverPendingReports()
    .catch((error: unknown) => {
      // Reporting fraud must never break location readiness for the user.
      LoggerService.error(`${FILE_NAME}: flushPendingMockLocationReports: flush failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      activeFlush = null;
      LoggerService.info(`${FILE_NAME}: flushPendingMockLocationReports: flush finished`);
    });

  await activeFlush;
}

/**
 * Records a mock-location detection and gets it to the back office.
 *
 * A mocked position always blocks the app, so every detection is worth
 * reporting — there is no configuration that makes one of these benign.
 *
 * Never rejects, and never blocks the readiness evaluation that called it: the
 * detection is persisted first, then delivery is attempted.
 */
export async function recordMockLocationDetection(
  input: MockLocationDetectionInput,
): Promise<void> {
  const now = Date.now();
  const lastReportedAtMs = lastReportedAtMsByStage[input.detectionStage] ?? null;
  const msSinceLastReport = lastReportedAtMs === null ? null : now - lastReportedAtMs;
  const isWithinCooldown =
    msSinceLastReport !== null && msSinceLastReport < REPEAT_DETECTION_COOLDOWN_MS;

  LoggerService.warn(`${FILE_NAME}: recordMockLocationDetection: mock location detected`, {
    detectionStage: input.detectionStage,
    isRepeatDetection: input.isRepeatDetection,
    isWithinCooldown,
  });

  if (input.isRepeatDetection && isWithinCooldown) {
    LoggerService.info(
      `${FILE_NAME}: recordMockLocationDetection: same episode within the cooldown — not reporting again`,
      { msSinceLastReport, cooldownMs: REPEAT_DETECTION_COOLDOWN_MS },
    );
    // The queue may still hold older detections from an offline stretch.
    await flushPendingMockLocationReports();
    return;
  }

  try {
    const device = await getDeviceFraudContext();

    enqueuePendingReport({
      clientEventId: createClientEventId(),
      detectionStage: input.detectionStage,
      detectedAt: new Date(now).toISOString(),
      fix: input.location
        ? {
            latitude: input.location.latitude,
            longitude: input.location.longitude,
            accuracyMeters: input.location.accuracyMeters,
            capturedAt: input.location.capturedAt.toISOString(),
            source: input.location.source,
          }
        : null,
      caseId: input.caseId ?? null,
      device,
    });

    lastReportedAtMsByStage = { ...lastReportedAtMsByStage, [input.detectionStage]: now };
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: recordMockLocationDetection: could not queue the detection`, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await flushPendingMockLocationReports();
}

/**
 * Clears the per-episode throttle so the next detection is reported
 * immediately. Called on logout: the next login has to report again, even if
 * the same handset was reported minutes ago. Queued reports are deliberately
 * left in place — an undelivered detection outlives the session.
 */
export function resetMockLocationReportThrottle(): void {
  LoggerService.info(`${FILE_NAME}: resetMockLocationReportThrottle: throttle cleared`);
  lastReportedAtMsByStage = {};
}
