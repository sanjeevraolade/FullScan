import { getCollection, sessionOption } from './connection.js';
import { fromDocument, type StoredDocument } from './documents.js';
import { nowTimestamp } from './timestamp.js';
import type { UiConfigRow } from '../types/ui-config.types.js';

type UiConfigDocument = StoredDocument<UiConfigRow>;

function uiConfigs() {
  return getCollection<UiConfigDocument>('ui_configs');
}

export async function findAllUiConfigs(): Promise<UiConfigRow[]> {
  const documents = await uiConfigs()
    .find({}, { sort: { screen_id: 1 }, ...sessionOption() })
    .toArray();
  return documents.map((document) => fromDocument<UiConfigRow>(document));
}

export async function findUiConfigByScreenId(screenId: string): Promise<UiConfigRow | undefined> {
  const document = await uiConfigs().findOne({ screen_id: screenId }, sessionOption());
  return document ? fromDocument<UiConfigRow>(document) : undefined;
}

export async function upsertUiConfig(
  id: string,
  screenId: string,
  title: string,
  configJson: string,
): Promise<UiConfigRow> {
  const now = nowTimestamp();

  // `version` starts at 1 on insert and goes up by one on every later save.
  await uiConfigs().updateOne(
    { screen_id: screenId },
    {
      $set: { title, config_json: configJson, updated_at: now },
      $inc: { version: 1 },
      $setOnInsert: { _id: id, created_at: now },
    },
    { upsert: true, ...sessionOption() },
  );

  return (await findUiConfigByScreenId(screenId))!;
}
