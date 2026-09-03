export type SettingValueType = 'boolean' | 'number' | 'string' | 'enum';

/** Settings groups the Admin Portal renders as separate sections, in this order. */
export const SETTING_CATEGORIES = ['general', 'security', 'evidence', 'sync'] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

/** Raw `mobile_app_settings` row — every value is stored as TEXT and coerced on read. */
export interface MobileAppSettingRow {
  readonly setting_key: string;
  readonly setting_value: string;
  readonly value_type: SettingValueType;
  readonly label: string;
  readonly description: string | null;
  readonly category: SettingCategory;
  readonly options_json: string | null;
  readonly min_value: number | null;
  readonly max_value: number | null;
  readonly sort_order: number;
  readonly updated_at: string | null;
  readonly updated_by: string | null;
}

/**
 * A setting plus the metadata needed to render and validate an input for it.
 * The Admin Portal builds its whole form from these — no hardcoded field list.
 */
export interface MobileAppSetting {
  readonly key: string;
  readonly value: boolean | number | string;
  readonly valueType: SettingValueType;
  readonly label: string;
  readonly description: string | null;
  readonly category: SettingCategory;
  readonly options: readonly string[] | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

/** One entry of a settings update request. Values arrive as-typed from the portal. */
export interface MobileAppSettingUpdate {
  readonly key: string;
  readonly value: boolean | number | string;
}
