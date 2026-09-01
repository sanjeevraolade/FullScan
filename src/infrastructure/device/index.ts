import {
  getVersion,
  getUniqueId,
  getDeviceName,
  getModel,
  getBrand,
  getSystemVersion,
  getSystemName,
} from 'react-native-device-info';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'infrastructure/device/index.ts';

export interface DeviceInfo {
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly systemName: string;
  readonly uniqueId: string;
}

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

/** Gets complete device information for device binding */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceInfo = {
    deviceName: await getDeviceName(),
    model: await getModel(),
    brand: await getBrand(),
    osVersion: await getSystemVersion(),
    appVersion: await getVersion(),
    systemName: await getSystemName(),
    uniqueId: await getUniqueId(),
  };

  LoggerService.info(`${FILE_NAME}: getDeviceInfo: collected device information`, {
    model: deviceInfo.model,
    brand: deviceInfo.brand,
    systemName: deviceInfo.systemName,
  });

  return deviceInfo;
}

/** Gets unique device ID for device binding */
export async function getDeviceId(): Promise<string> {
  const uniqueId = await getUniqueId();
  LoggerService.info(`${FILE_NAME}: getDeviceId: resolved device id`);
  return uniqueId;
}
