import type { DeviceView } from './device.types.js';
import type { FieldExecutive } from './field-executive.types.js';

/**
 * The handset the field executive's account is bound to, recorded by the mobile
 * app's login (`field_executives.device_id` + `device_details`). Every field except
 * `deviceId` is null when the stored details are missing or unreadable; the binding
 * itself is still shown.
 */
export type FeWebMobileDevice = DeviceView;

export interface FeWebProfile {
  readonly fieldExecutive: FieldExecutive;
  /** null when the FE has not signed in to the mobile app (no device bound). */
  readonly mobileDevice: FeWebMobileDevice | null;
}
