import { calculateHaversineDistanceMeters } from '@/core/utils';
import { LoggerService } from '@/infrastructure/logger';

import type { IDistanceService } from './distance.interface';
import type { DistanceRequest, DistanceResult } from './distance.types';

const FILE_NAME = 'local-distance.service.ts';

/**
 * Straight-line distance via the Haversine formula.
 *
 * No API call, no billing, works offline, same answer every time — which is
 * exactly why geo-fence validation is defined in terms of this service and
 * never in terms of a routing API.
 */
async function calculateDistance(request: DistanceRequest): Promise<DistanceResult> {
  LoggerService.info(`${FILE_NAME}: calculateDistance: calculating haversine distance`);
  const distanceMeters = calculateHaversineDistanceMeters(request.from, request.to);
  LoggerService.info(`${FILE_NAME}: calculateDistance: distance calculated locally`, {
    distanceMeters: Math.round(distanceMeters),
  });

  return {
    distanceMeters,
    distanceMethod: 'local',
    calculatedAt: new Date(),
    durationSeconds: null,
  };
}

export const LocalDistanceService: IDistanceService = { method: 'local', calculateDistance };
