import type { MobileAppSetting, MobileAppSettingUpdate, SettingValue } from '../types/settings';

/** What each input holds: a checkbox's boolean, or the raw text of any other control. */
export type SettingInputValue = boolean | string;

export function toInputValue(setting: MobileAppSetting): SettingInputValue {
  return setting.valueType === 'boolean' ? setting.value === true : String(setting.value);
}

export function toInputValues(settings: readonly MobileAppSetting[]): Record<string, SettingInputValue> {
  return Object.fromEntries(settings.map((setting) => [setting.key, toInputValue(setting)]));
}

export interface SettingChange {
  readonly setting: MobileAppSetting;
  readonly value: SettingValue;
  /** Set when the input cannot be sent as-is (an empty or non-numeric number, out of range). */
  readonly problem: string | null;
}

function parseInput(setting: MobileAppSetting, input: SettingInputValue): { value: SettingValue; problem: string | null } {
  if (setting.valueType === 'boolean') {
    return { value: input === true, problem: null };
  }

  const text = typeof input === 'string' ? input : String(input);

  if (setting.valueType === 'number') {
    const trimmed = text.trim();
    const number = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(number)) {
      return { value: text, problem: `"${setting.label}" needs a number.` };
    }
    if (setting.minValue !== null && number < setting.minValue) {
      return { value: number, problem: `"${setting.label}" must be at least ${setting.minValue}.` };
    }
    if (setting.maxValue !== null && number > setting.maxValue) {
      return { value: number, problem: `"${setting.label}" must be at most ${setting.maxValue}.` };
    }
    return { value: number, problem: null };
  }

  if (setting.valueType === 'string' && text.length > 500) {
    return { value: text, problem: `"${setting.label}" must be 500 characters or fewer.` };
  }

  return { value: text, problem: null };
}

/** Settings whose input differs from the saved value — only these are sent. */
export function collectSettingChanges(
  settings: readonly MobileAppSetting[],
  inputs: Readonly<Record<string, SettingInputValue>>,
): readonly SettingChange[] {
  const changes: SettingChange[] = [];

  for (const setting of settings) {
    const input = inputs[setting.key];
    if (input === undefined) {
      continue;
    }
    const { value, problem } = parseInput(setting, input);
    if (problem || value !== setting.value) {
      changes.push({ setting, value, problem });
    }
  }

  return changes;
}

export function toSettingUpdates(changes: readonly SettingChange[]): readonly MobileAppSettingUpdate[] {
  return changes.map((change) => ({ key: change.setting.key, value: change.value }));
}

export interface SettingGroup {
  readonly category: string;
  readonly settings: readonly MobileAppSetting[];
}

/** Groups in the order categories first appear (the API sorts by category then position). */
export function groupSettingsByCategory(settings: readonly MobileAppSetting[]): readonly SettingGroup[] {
  const groups = new Map<string, MobileAppSetting[]>();
  for (const setting of settings) {
    const group = groups.get(setting.category) ?? [];
    group.push(setting);
    groups.set(setting.category, group);
  }
  return [...groups].map(([category, grouped]) => ({ category, settings: grouped }));
}
