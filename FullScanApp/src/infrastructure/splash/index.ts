import BootSplash from 'react-native-bootsplash';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'infrastructure/splash/index.ts';

/**
 * Hide the native splash screen with a fade animation.
 * Call this once the app is ready (e.g., after navigation is mounted
 * and initial configuration/localization is loaded).
 */
export const hideSplashScreen = async (): Promise<void> => {
  LoggerService.info(`${FILE_NAME}: hideSplashScreen: hiding native splash screen`);
  await BootSplash.hide({ fade: true });
  LoggerService.info(`${FILE_NAME}: hideSplashScreen: splash screen hidden`);
};

/**
 * Check whether the splash screen is currently visible.
 */
export const isSplashVisible = (): boolean => {
  const isVisible = BootSplash.isVisible();
  LoggerService.info(`${FILE_NAME}: isSplashVisible: checked splash visibility`, { isVisible });
  return isVisible;
};
