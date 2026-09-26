import * as mobileAppSettingDao from '../db/mobile-app-setting.dao.js';
import { AppError } from '../utils/app-error.js';
import type {
  MobileAppSetting,
  MobileAppSettingRow,
  MobileAppSettingUpdate,
} from '../types/mobile-app-setting.types.js';

const MAX_STRING_LENGTH = 500;

/** Values are stored as text; coerce back to the type the row declares. */
function parseSettingValue(row: MobileAppSettingRow): boolean | number | string {
  if (row.value_type === 'boolean') {
    return row.setting_value === 'true';
  }
  if (row.value_type === 'number') {
    return Number(row.setting_value);
  }
  return row.setting_value;
}

function parseSettingOptions(row: MobileAppSettingRow): readonly string[] | null {
  if (!row.options_json) {
    return null;
  }
  return JSON.parse(row.options_json) as string[];
}

function toMobileAppSetting(row: MobileAppSettingRow): MobileAppSetting {
  return {
    key: row.setting_key,
    value: parseSettingValue(row),
    valueType: row.value_type,
    label: row.label,
    description: row.description,
    category: row.category,
    options: parseSettingOptions(row),
    minValue: row.min_value,
    maxValue: row.max_value,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function getAllMobileAppSettings(): Promise<MobileAppSetting[]> {
  return (await mobileAppSettingDao.findAllMobileAppSettings()).map(toMobileAppSetting);
}

/**
 * Validates one submitted value against its row's declared type, allowed options
 * and min/max, and returns it in the text form the setting stores.
 * Throws AppError(400) with a message naming the offending setting.
 */
function serializeSettingValue(
  row: MobileAppSettingRow,
  value: boolean | number | string,
): string {
  if (row.value_type === 'boolean') {
    if (typeof value === 'boolean') {
      return String(value);
    }
    if (value === 'true' || value === 'false') {
      return value;
    }
    throw new AppError(400, `"${row.label}" must be true or false`);
  }

  if (row.value_type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      throw new AppError(400, `"${row.label}" must be a number`);
    }
    if (row.min_value !== null && numeric < row.min_value) {
      throw new AppError(400, `"${row.label}" must be at least ${row.min_value}`);
    }
    if (row.max_value !== null && numeric > row.max_value) {
      throw new AppError(400, `"${row.label}" must be at most ${row.max_value}`);
    }
    return String(numeric);
  }

  if (typeof value !== 'string') {
    throw new AppError(400, `"${row.label}" must be text`);
  }

  if (row.value_type === 'enum') {
    const options = parseSettingOptions(row) || [];
    if (!options.includes(value)) {
      throw new AppError(400, `"${row.label}" must be one of: ${options.join(', ')}`);
    }
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length > MAX_STRING_LENGTH) {
    throw new AppError(400, `"${row.label}" must be ${MAX_STRING_LENGTH} characters or fewer`);
  }
  return trimmed;
}

/**
 * Applies a batch of setting changes on behalf of an admin.
 * Every value is validated before anything is written, and the write itself is a
 * single transaction — an invalid entry rejects the whole batch.
 */
export async function updateMobileAppSettings(
  updates: readonly MobileAppSettingUpdate[],
  adminUserId: string,
): Promise<MobileAppSetting[]> {
  if (updates.length === 0) {
    throw new AppError(400, 'No settings supplied');
  }

  const seenKeys = new Set<string>();
  const serialized: { key: string; value: string }[] = [];

  for (const { key, value } of updates) {
    if (seenKeys.has(key)) {
      throw new AppError(400, `Duplicate setting in request: ${key}`);
    }
    seenKeys.add(key);

    const row = await mobileAppSettingDao.findMobileAppSettingByKey(key);
    if (!row) {
      throw new AppError(400, `Unknown setting: ${key}`);
    }

    serialized.push({ key, value: serializeSettingValue(row, value) });
  }

  await mobileAppSettingDao.updateMobileAppSettings(serialized, adminUserId);

  return getAllMobileAppSettings();
}
