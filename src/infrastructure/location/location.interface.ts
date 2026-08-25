import type { LocationWatchCallback, LocationWatchErrorCallback } from './location.types';

export interface ILocationService {
  requestPermission(): Promise<boolean>;
  /** Returns a watch id to pass to {@link ILocationService.clearWatch}. */
  watchLocation(onLocation: LocationWatchCallback, onError: LocationWatchErrorCallback): number;
  clearWatch(watchId: number): void;
}
