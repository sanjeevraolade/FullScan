import type { Document } from 'mongodb';
import { getCollection, runInTransaction, sessionOption } from './connection.js';
import { nowTimestamp } from './timestamp.js';
import type { MobileAppSettingRow } from '../types/mobile-app-setting.types.js';

/** `setting_key` is this collection's primary key, so it is the one stored as `_id`. */
type MobileAppSettingDocument = Omit<MobileAppSettingRow, 'setting_key'> & { _id: string };

function mobileAppSettings() {
  return getCollection<MobileAppSettingDocument>('mobile_app_settings');
}

function toRow(document: Document): MobileAppSettingRow {
  const { _id, ...fields } = document;
  return { setting_key: _id, ...fields } as MobileAppSettingRow;
}

export async function findAllMobileAppSettings(): Promise<MobileAppSettingRow[]> {
  const documents = await mobileAppSettings()
    .find({}, { sort: { category: 1, sort_order: 1, _id: 1 }, ...sessionOption() })
    .toArray();
  return documents.map(toRow);
}

export async function findMobileAppSettingByKey(key: string): Promise<MobileAppSettingRow | undefined> {
  const document = await mobileAppSettings().findOne({ _id: key }, sessionOption());
  return document ? toRow(document) : undefined;
}

/**
 * Writes several settings in one transaction so a partially-valid batch can never
 * leave the mobile app reading a half-applied configuration.
 */
export async function updateMobileAppSettings(
  updates: ReadonlyArray<{ key: string; value: string }>,
  updatedBy: string,
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const updatedAt = nowTimestamp();

  await runInTransaction(async () => {
    await mobileAppSettings().bulkWrite(
      updates.map((update) => ({
        updateOne: {
          filter: { _id: update.key },
          update: { $set: { setting_value: update.value, updated_by: updatedBy, updated_at: updatedAt } },
        },
      })),
      sessionOption(),
    );
  });
}
