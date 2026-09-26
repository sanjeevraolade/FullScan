import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { toFieldExecutive } from './field-executive.service.js';
import { AppError } from '../utils/app-error.js';
import { parseDeviceDetails } from '../utils/device-details.js';
import type { FieldExecutiveRow } from '../types/field-executive.types.js';
import type { FeWebMobileDevice, FeWebProfile } from '../types/fe-web-profile.types.js';

function toMobileDevice(row: FieldExecutiveRow): FeWebMobileDevice | null {
  if (!row.device_id) {
    return null;
  }

  return {
    deviceId: row.device_id,
    ...parseDeviceDetails(row.device_details, { fieldExecutiveId: row.id }),
  };
}

/**
 * The signed-in field executive's profile, plus the mobile device their account is
 * currently bound to.
 */
export async function getProfileForFieldExecutive(fieldExecutiveId: string): Promise<FeWebProfile> {
  const row = await fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);

  if (!row) {
    throw new AppError(404, 'No field executive session found');
  }

  return {
    fieldExecutive: toFieldExecutive(row),
    mobileDevice: toMobileDevice(row),
  };
}
