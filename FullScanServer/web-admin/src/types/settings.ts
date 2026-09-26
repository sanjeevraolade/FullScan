export type SettingValueType = 'boolean' | 'number' | 'string' | 'enum';
export type SettingValue = boolean | number | string;

export interface MobileAppSetting {
  readonly key: string;
  readonly value: SettingValue;
  readonly valueType: SettingValueType;
  readonly label: string;
  readonly description: string | null;
  /** `general`, `security`, `evidence`, `sync` today — unknown categories still render. */
  readonly category: string;
  readonly options: readonly string[] | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export interface MobileAppSettingUpdate {
  readonly key: string;
  readonly value: SettingValue;
}
