import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'geo-fence.service.ts';

/** Which distance source produced a decision — see `DistanceService`. */
export type GeoFenceDistanceMethod = 'local' | 'directions';

export interface GeoFenceEvaluationInput {
  readonly distanceMeters: number;
  readonly radiusMeters: number;
  readonly distanceMethod: GeoFenceDistanceMethod;
}

export interface GeoFenceEvaluation {
  readonly isWithinFence: boolean;
  readonly distanceMeters: number;
  readonly radiusMeters: number;
  readonly distanceMethod: GeoFenceDistanceMethod;
  readonly evaluatedAt: Date;
}

/**
 * The geo-fence business rule, and nothing else: is the measured distance
 * within the configured radius?
 *
 * The boundary is inclusive — standing exactly `radiusMeters` away is inside.
 * GPS accuracy is metres-wide at best, so excluding the boundary would only
 * ever punish a field executive for rounding.
 */
export function evaluateGeoFence({
  distanceMeters,
  radiusMeters,
  distanceMethod,
}: GeoFenceEvaluationInput): GeoFenceEvaluation {
  LoggerService.info(`${FILE_NAME}: evaluateGeoFence: entry`, {
    distanceMeters,
    radiusMeters,
    distanceMethod,
  });

  const hasMeasurableInputs = Number.isFinite(distanceMeters) && Number.isFinite(radiusMeters);

  if (!hasMeasurableInputs) {
    LoggerService.warn(
      `${FILE_NAME}: evaluateGeoFence: treated as outside — distance or radius is non-finite`,
      { distanceMeters, radiusMeters, distanceMethod },
    );
  }

  const isWithinFence =
    Number.isFinite(distanceMeters) &&
    Number.isFinite(radiusMeters) &&
    distanceMeters <= radiusMeters;

  if (hasMeasurableInputs) {
    LoggerService.info(`${FILE_NAME}: evaluateGeoFence: decision`, {
      isWithinFence,
      distanceMeters,
      radiusMeters,
      distanceMethod,
    });
  }

  return {
    isWithinFence,
    distanceMeters,
    radiusMeters,
    distanceMethod,
    evaluatedAt: new Date(),
  };
}

/**
 * A record of a field executive knowingly proceeding without satisfying the
 * geo-fence. Submitted with the verification outcome so the back office can
 * scrutinize the case, and kept per-case so the consent is never implied.
 */
export interface GeoFenceBypassConsent {
  readonly caseId: string;
  readonly consentedAtIso: string;
  /** Best distance measured before the user gave up, or `null` if none was ever obtained. */
  readonly lastDistanceMeters: number | null;
  readonly radiusMeters: number;
  /** How many recalculation attempts the user made before proceeding. */
  readonly attemptCount: number;
}
