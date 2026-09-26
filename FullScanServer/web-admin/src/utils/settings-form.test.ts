import { describe, expect, it } from 'vitest';
import type { MobileAppSetting } from '../types/settings';
import { collectSettingChanges, groupSettingsByCategory, toInputValues, toSettingUpdates } from './settings-form';

function setting(overrides: Partial<MobileAppSetting> & Pick<MobileAppSetting, 'key' | 'value' | 'valueType'>): MobileAppSetting {
  return {
    label: overrides.key,
    description: null,
    category: 'general',
    options: null,
    minValue: null,
    maxValue: null,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

const settings: MobileAppSetting[] = [
  setting({ key: 'maintenance', value: false, valueType: 'boolean' }),
  setting({ key: 'radius', value: 200, valueType: 'number', minValue: 50, maxValue: 1000, category: 'evidence' }),
  setting({ key: 'language', value: 'en', valueType: 'enum', options: ['en', 'hi', 'te'] }),
  setting({ key: 'banner', value: 'Hello', valueType: 'string', category: 'evidence' }),
];

describe('settings form', () => {
  it('has no changes when inputs match the saved values', () => {
    expect(collectSettingChanges(settings, toInputValues(settings))).toEqual([]);
  });

  it('sends only changed settings, typed as the setting declares', () => {
    const inputs = { ...toInputValues(settings), maintenance: true, radius: '300', language: 'te' };

    expect(toSettingUpdates(collectSettingChanges(settings, inputs))).toEqual([
      { key: 'maintenance', value: true },
      { key: 'radius', value: 300 },
      { key: 'language', value: 'te' },
    ]);
  });

  it('treats a number typed back to its saved value as unchanged', () => {
    expect(collectSettingChanges(settings, { ...toInputValues(settings), radius: '200.0' })).toEqual([]);
  });

  it('flags empty, non-numeric and out-of-range numbers', () => {
    for (const radius of ['', 'abc', '10', '5000']) {
      const [change] = collectSettingChanges(settings, { ...toInputValues(settings), radius });
      expect(change?.problem, radius).toBeTruthy();
    }
  });

  it('groups settings by category in first-seen order', () => {
    expect(groupSettingsByCategory(settings).map((group) => [group.category, group.settings.length])).toEqual([
      ['general', 2],
      ['evidence', 2],
    ]);
  });
});
