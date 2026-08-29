import type { ScreenConfig, ComponentConfig } from '../types/ui-config.types.js';
import * as uiConfigDao from '../db/ui-config.dao.js';
import { AppError } from '../utils/app-error.js';
import { v4 as uuidv4 } from 'uuid';

export function getAllScreenConfigs(): ScreenConfig[] {
  const rows = uiConfigDao.findAllUiConfigs();

  return rows.map((row) => ({
    screenId: row.screen_id,
    version: row.version,
    title: row.title,
    components: JSON.parse(row.config_json) as ComponentConfig[],
    updatedAt: row.updated_at,
  }));
}

export function getScreenConfig(screenId: string): ScreenConfig {
  const row = uiConfigDao.findUiConfigByScreenId(screenId);

  if (!row) {
    throw new AppError(404, `Screen config not found: ${screenId}`);
  }

  return {
    screenId: row.screen_id,
    version: row.version,
    title: row.title,
    components: JSON.parse(row.config_json) as ComponentConfig[],
    updatedAt: row.updated_at,
  };
}

export function updateScreenConfig(
  screenId: string,
  title: string,
  components: ComponentConfig[],
): ScreenConfig {
  const configJson = JSON.stringify(components);
  const id = uuidv4();
  const row = uiConfigDao.upsertUiConfig(id, screenId, title, configJson);

  return {
    screenId: row.screen_id,
    version: row.version,
    title: row.title,
    components: JSON.parse(row.config_json) as ComponentConfig[],
    updatedAt: row.updated_at,
  };
}
