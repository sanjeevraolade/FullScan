import type { DeviceView } from '../types/device-change';
import type { MockLocationEventDevice, MockLocationHistoryEvent } from '../types/field-executives';

/** Handsets report brands in lower case (`samsung`) — tidy the first letter only. */
export function capitalize(value: string | null): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

/** `{ title: 'Galaxy S25', details: 'Samsung SM-S931B · Android 16 · app 1.0' }` */
export function describeDevice(device: DeviceView): { readonly title: string; readonly details: string } {
  const hardware = [capitalize(device.brand), device.model].filter(Boolean).join(' ');
  const operatingSystem = [device.systemName, device.osVersion].filter(Boolean).join(' ');

  return {
    title: device.deviceName || hardware || 'Unknown phone',
    details: [device.deviceName ? hardware : '', operatingSystem, device.appVersion ? `app ${device.appVersion}` : '']
      .filter(Boolean)
      .join(' · '),
  };
}

export function describeDetectionDevice(device: MockLocationEventDevice): string {
  const hardware = [device.manufacturer || device.brand, device.model].filter(Boolean).join(' ');
  const operatingSystem = [device.osName, device.osVersion].filter(Boolean).join(' ');
  return [hardware, operatingSystem].filter(Boolean).join(' · ') || 'Device details not reported';
}

export function formatCoordinates(event: MockLocationHistoryEvent): string {
  if (event.latitude === null || event.longitude === null) {
    return 'No coordinates reported';
  }
  const accuracy = event.accuracyMeters === null ? '' : ` · ±${Math.round(event.accuracyMeters)} m`;
  return `${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}${accuracy}`;
}
