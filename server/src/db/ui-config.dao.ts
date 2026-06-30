import { getDb } from './connection.js';
import type { UiConfigRow } from '../types/ui-config.types.js';

export function findAllUiConfigs(): UiConfigRow[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ui_configs ORDER BY screen_id');
  return stmt.all() as UiConfigRow[];
}

export function findUiConfigByScreenId(screenId: string): UiConfigRow | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ui_configs WHERE screen_id = ?');
  return stmt.get(screenId) as UiConfigRow | undefined;
}

export function upsertUiConfig(
  id: string,
  screenId: string,
  title: string,
  configJson: string,
): UiConfigRow {
  const db = getDb();
  const existing = findUiConfigByScreenId(screenId);

  if (existing) {
    const newVersion = existing.version + 1;
    db.prepare(`
      UPDATE ui_configs
      SET config_json = ?, title = ?, version = ?, updated_at = datetime('now')
      WHERE screen_id = ?
    `).run(configJson, title, newVersion, screenId);
  } else {
    db.prepare(`
      INSERT INTO ui_configs (id, screen_id, version, title, config_json)
      VALUES (?, ?, 1, ?, ?)
    `).run(id, screenId, title, configJson);
  }

  return findUiConfigByScreenId(screenId)!;
}
