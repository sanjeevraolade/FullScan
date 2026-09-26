import {
  getVersion,
  getUniqueId,
  getDeviceName,
  getModel,
  getBrand,
  getBuildNumber,
  getDeviceType,
  getInstallerPackageName,
  getManufacturer,
  getSystemVersion,
  getSystemName,
  isEmulator,
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
  LoggerService.info(`${FILE_NAME}: getAppVersion: reading app version`);
  const version = getVersion();
  LoggerService.info(`${FILE_NAME}: getAppVersion: resolved app version`, { version });
  return version;
}

/** Gets complete device information for device binding */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  // The unique id and device name identify the executive's handset — never logged.
  LoggerService.info(`${FILE_NAME}: getDeviceInfo: collecting device information`);
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
  LoggerService.info(`${FILE_NAME}: getDeviceId: reading unique device id`);
  const uniqueId = await getUniqueId();
  LoggerService.info(`${FILE_NAME}: getDeviceId: resolved device id`);
  return uniqueId;
}

/**
 * Everything the handset can say about itself, collected for a fraud report.
 *
 * Wider than {@link DeviceInfo} on purpose: a mock-location detection is
 * evidence, and the fields that only matter there — who built the handset, how
 * the app was installed, whether this is an emulator, which time zone the
 * device claims — are exactly what separates a rooted handset running a
 * fake-GPS app from an honest one with a bad fix.
 *
 * Every reader is individually guarded: a device that refuses to answer one
 * question must still produce a report, so a failed reader yields an empty
 * value rather than losing the whole detection.
 */
export interface DeviceFraudContext {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly model: string;
  readonly brand: string;
  readonly manufacturer: string;
  readonly deviceType: string;
  readonly systemName: string;
  readonly osVersion: string;
  readonly appVersion: string;
  readonly appBuildNumber: string;
  readonly installerPackageName: string;
  readonly isEmulator: boolean;
  readonly timeZone: string;
}

async function readDeviceValue<TValue>(
  readerName: string,
  read: () => TValue | Promise<TValue>,
  fallback: TValue,
): Promise<TValue> {
  try {
    const value = await read();
    LoggerService.info(`${FILE_NAME}: readDeviceValue: reader answered`, { readerName });
    return value;
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: readDeviceValue: reader failed, using fallback`, {
      readerName,
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

/** The device's own time zone, which a tampered handset often gets wrong. */
function resolveTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    LoggerService.info(`${FILE_NAME}: resolveTimeZone: resolved`, { hasTimeZone: timeZone.length > 0 });
    return timeZone;
  } catch (error: unknown) {
    LoggerService.error(`${FILE_NAME}: resolveTimeZone: time zone unavailable`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

/** Collects the full device context that accompanies a security/fraud report. */
export async function getDeviceFraudContext(): Promise<DeviceFraudContext> {
  // The unique id and device name identify the executive's handset — never logged.
  LoggerService.info(`${FILE_NAME}: getDeviceFraudContext: collecting device fraud context`);

  const context: DeviceFraudContext = {
    deviceId: await readDeviceValue('getUniqueId', getUniqueId, ''),
    deviceName: await readDeviceValue('getDeviceName', getDeviceName, ''),
    model: await readDeviceValue('getModel', getModel, ''),
    brand: await readDeviceValue('getBrand', getBrand, ''),
    manufacturer: await readDeviceValue('getManufacturer', getManufacturer, ''),
    deviceType: await readDeviceValue('getDeviceType', getDeviceType, ''),
    systemName: await readDeviceValue('getSystemName', getSystemName, ''),
    osVersion: await readDeviceValue('getSystemVersion', getSystemVersion, ''),
    appVersion: await readDeviceValue('getVersion', getVersion, ''),
    appBuildNumber: await readDeviceValue('getBuildNumber', getBuildNumber, ''),
    installerPackageName: await readDeviceValue(
      'getInstallerPackageName',
      getInstallerPackageName,
      '',
    ),
    isEmulator: await readDeviceValue('isEmulator', isEmulator, false),
    timeZone: resolveTimeZone(),
  };

  LoggerService.info(`${FILE_NAME}: getDeviceFraudContext: collected device fraud context`, {
    model: context.model,
    brand: context.brand,
    manufacturer: context.manufacturer,
    systemName: context.systemName,
    osVersion: context.osVersion,
    appVersion: context.appVersion,
    isEmulator: context.isEmulator,
  });

  return context;
}
