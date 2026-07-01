import BootSplash from 'react-native-bootsplash';

/**
 * Hide the native splash screen with a fade animation.
 * Call this once the app is ready (e.g., after navigation is mounted
 * and initial configuration/localization is loaded).
 */
export const hideSplashScreen = async (): Promise<void> => {
  await BootSplash.hide({ fade: true });
};

/**
 * Check whether the splash screen is currently visible.
 */
export const isSplashVisible = async (): Promise<boolean> => {
  const status = await BootSplash.getVisibilityStatus();
  return status === 'visible' || status === 'transitioning';
};
