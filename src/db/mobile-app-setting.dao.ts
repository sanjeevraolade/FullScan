import { getDb } from './connection.js';
import type { MobileAppSettingRow } from '../types/mobile-app-setting.types.js';

export function findAllMobileAppSettings(): MobileAppSettingRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM mobile_app_settings ORDER BY category, sort_order, setting_key')
    .all() as MobileAppSettingRow[];
}

export function findMobileAppSettingByKey(key: string): MobileAppSettingRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM mobile_app_settings WHERE setting_key = ?').get(key) as
    | MobileAppSettingRow
    | undefined;
}

/**
 * Writes several settings in one transaction so a partially-valid batch can never
 * leave the mobile app reading a half-applied configuration.
 */
export function updateMobileAppSettings(
  updates: ReadonlyArray<{ key: string; value: string }>,
  updatedBy: string,
): void {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE mobile_app_settings SET setting_value = ?, updated_by = ?, updated_at = datetime('now') WHERE setting_key = ?",
  );

  const runAll = db.transaction((rows: ReadonlyArray<{ key: string; value: string }>) => {
    for (const row of rows) {
      stmt.run(row.value, updatedBy, row.key);
    }
  });

  runAll(updates);
}
