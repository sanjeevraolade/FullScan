import NetInfo from '@react-native-community/netinfo';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'connectivity.service.ts';

export interface IConnectivityService {
  /**
   * Whether a network request is worth attempting right now.
   *
   * Advisory only: never gate a feature that can work offline on this. It
   * exists so the app can skip a request that is certain to fail and say
   * "you're offline" instead of "something went wrong".
   */
  isConnected(): Promise<boolean>;
}

async function isConnected(): Promise<boolean> {
  LoggerService.info(`${FILE_NAME}: isConnected: checking connectivity`);
  try {
    const state = await NetInfo.fetch();
    // `isInternetReachable` is null while NetInfo is still probing — treat
    // that as connected so an unknown state never blocks a request.
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    LoggerService.info(`${FILE_NAME}: isConnected: connectivity resolved`, {
      isOnline,
      type: state.type,
    });
    return isOnline;
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: isConnected: connectivity check failed, assuming online`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

export const ConnectivityService: IConnectivityService = { isConnected };
