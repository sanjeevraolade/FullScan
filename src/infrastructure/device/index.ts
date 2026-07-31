import { getVersion } from 'react-native-device-info';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'infrastructure/device/index.ts';

/**
 * Current app version (e.g. "1.4.2") from the native build. The one place
 * that wraps `react-native-device-info` so screens read device capabilities
 * through `infrastructure/` instead of importing the library directly.
 */
export function getAppVersion(): string {
  const version = getVersion();
  LoggerService.info(`${FILE_NAME}: getAppVersion: resolved app version`, { version });
  return version;
}
