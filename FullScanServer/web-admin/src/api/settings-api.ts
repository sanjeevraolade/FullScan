import { apiRequest } from './client';
import { mobileAppSettingListSchema } from './schemas';
import type { MobileAppSetting, MobileAppSettingUpdate } from '../types/settings';

export const settingsApi = {
  fetchSettings(signal?: AbortSignal): Promise<readonly MobileAppSetting[]> {
    return apiRequest('/mobile-app-settings', mobileAppSettingListSchema, { signal });
  },

  /** Answers with every setting after the change — the new saved baseline. */
  updateSettings(settings: readonly MobileAppSettingUpdate[]): Promise<readonly MobileAppSetting[]> {
    return apiRequest('/mobile-app-settings', mobileAppSettingListSchema, { method: 'PUT', body: { settings } });
  },
};
