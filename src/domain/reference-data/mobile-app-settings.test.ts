import type { MobileAppSettings } from './reference-data.entity';
import {
  DEFAULT_MOBILE_APP_SETTINGS,
  MOBILE_APP_SETTING_KEYS,
  MOBILE_APP_SETTING_RANGES,
  resolveMobileAppSettings,
} from './mobile-app-settings';

function buildSettings(values: Record<string, boolean | number | string>): MobileAppSettings {
  return { values, updatedAt: '2026-09-03 12:00:00' };
}

describe('resolveMobileAppSettings', () => {
  describe('when settings have not been fetched yet', () => {
    it('returns the safe defaults for null', () => {
      const resolved = resolveMobileAppSettings(null);

      expect(resolved).toMatchObject(DEFAULT_MOBILE_APP_SETTINGS);
      expect(resolved.values).toEqual({});
      expect(resolved.updatedAt).toBeNull();
    });

    it('returns the safe defaults for undefined', () => {
      expect(resolveMobileAppSettings(undefined)).toMatchObject(DEFAULT_MOBILE_APP_SETTINGS);
    });

    it('defaults the security-relevant settings to the strict option', () => {
      const resolved = resolveMobileAppSettings(null);

      expect(resolved.isWatermarkEnabled).toBe(true);
      expect(resolved.isMockLocationBlockEnabled).toBe(true);
      expect(resolved.isMaintenanceModeEnabled).toBe(false);
      expect(resolved.isForceUpdateEnabled).toBe(false);
    });
  });

  describe('with a full payload', () => {
    it('maps every known key to its typed field', () => {
      const resolved = resolveMobileAppSettings(
        buildSettings({
          min_supported_app_version: '2.1.0',
          force_update_enabled: true,
          default_language: 'te',
          support_contact_number: '+911800123456',
          maintenance_mode_enabled: true,
          maintenance_message: 'Back at 6pm',
          biometric_login_enabled: false,
          mock_location_block_enabled: false,
          session_timeout_minutes: 60,
          max_login_attempts: 3,
          geo_fence_radius_meters: 500,
          locationRetryCount: 7,
          photo_compression_quality: 55,
          max_photo_upload_size_mb: 12,
          watermark_enabled: false,
          sync_interval_minutes: 30,
          offline_queue_retry_limit: 8,
          sync_on_wifi_only: true,
        }),
      );

      expect(resolved).toMatchObject({
        minSupportedAppVersion: '2.1.0',
        isForceUpdateEnabled: true,
        defaultLanguage: 'te',
        supportContactNumber: '+911800123456',
        isMaintenanceModeEnabled: true,
        maintenanceMessage: 'Back at 6pm',
        isBiometricLoginEnabled: false,
        isMockLocationBlockEnabled: false,
        sessionTimeoutMinutes: 60,
        maxLoginAttempts: 3,
        geoFenceRadiusMeters: 500,
        locationRetryCount: 7,
        photoCompressionQuality: 55,
        maxPhotoUploadSizeMb: 12,
        isWatermarkEnabled: false,
        syncIntervalMinutes: 30,
        offlineQueueRetryLimit: 8,
        isSyncOnWifiOnly: true,
      });
    });

    it('carries the updatedAt watermark through', () => {
      expect(resolveMobileAppSettings(buildSettings({})).updatedAt).toBe('2026-09-03 12:00:00');
    });
  });

  describe('partial and malformed payloads', () => {
    it('falls back per setting, keeping the ones that are present', () => {
      const resolved = resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: 400 }));

      expect(resolved.geoFenceRadiusMeters).toBe(400);
      expect(resolved.syncIntervalMinutes).toBe(DEFAULT_MOBILE_APP_SETTINGS.syncIntervalMinutes);
    });

    it('accepts booleans that arrive as "true"/"false" strings', () => {
      const resolved = resolveMobileAppSettings(
        buildSettings({ watermark_enabled: 'false', sync_on_wifi_only: 'true' }),
      );

      expect(resolved.isWatermarkEnabled).toBe(false);
      expect(resolved.isSyncOnWifiOnly).toBe(true);
    });

    it('falls back when a boolean arrives as something else entirely', () => {
      const resolved = resolveMobileAppSettings(buildSettings({ watermark_enabled: 'maybe' }));

      expect(resolved.isWatermarkEnabled).toBe(true);
    });

    it('accepts numbers that arrive as numeric strings', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: '275' }))
          .geoFenceRadiusMeters,
      ).toBe(275);
    });

    it('falls back for a non-numeric string, rather than yielding NaN', () => {
      const resolved = resolveMobileAppSettings(
        buildSettings({ geo_fence_radius_meters: 'far-ish' }),
      );

      expect(resolved.geoFenceRadiusMeters).toBe(DEFAULT_MOBILE_APP_SETTINGS.geoFenceRadiusMeters);
      expect(Number.isNaN(resolved.geoFenceRadiusMeters)).toBe(false);
    });

    it('falls back for a non-finite number', () => {
      expect(
        resolveMobileAppSettings(
          buildSettings({ session_timeout_minutes: Number.POSITIVE_INFINITY }),
        ).sessionTimeoutMinutes,
      ).toBe(DEFAULT_MOBILE_APP_SETTINGS.sessionTimeoutMinutes);
    });

    it('trims string values and treats a blank one as absent', () => {
      const resolved = resolveMobileAppSettings(
        buildSettings({ min_supported_app_version: '  3.0.0  ', maintenance_message: '   ' }),
      );

      expect(resolved.minSupportedAppVersion).toBe('3.0.0');
      expect(resolved.maintenanceMessage).toBe(DEFAULT_MOBILE_APP_SETTINGS.maintenanceMessage);
    });

    it('ignores a language this build cannot render', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ default_language: 'fr' })).defaultLanguage,
      ).toBe('en');
    });

    it('accepts each language the app does ship', () => {
      for (const language of ['en', 'hi', 'te'] as const) {
        expect(
          resolveMobileAppSettings(buildSettings({ default_language: language })).defaultLanguage,
        ).toBe(language);
      }
    });
  });

  describe('locationRetryCount', () => {
    it('defaults to 3 when absent', () => {
      expect(resolveMobileAppSettings(null).locationRetryCount).toBe(3);
      expect(DEFAULT_MOBILE_APP_SETTINGS.locationRetryCount).toBe(3);
    });

    it('reads a value inside the 3-10 range', () => {
      for (const count of [3, 5, 10]) {
        expect(
          resolveMobileAppSettings(buildSettings({ locationRetryCount: count })).locationRetryCount,
        ).toBe(count);
      }
    });

    it('falls back for a value below the minimum of 3', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ locationRetryCount: 2 })).locationRetryCount,
      ).toBe(3);
    });

    it('falls back for a value above the maximum of 10', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ locationRetryCount: 11 })).locationRetryCount,
      ).toBe(3);
    });

    it('is keyed camelCase on the wire, as the mobile contract specifies', () => {
      expect(MOBILE_APP_SETTING_KEYS.locationRetryCount).toBe('locationRetryCount');

      // The snake_case spelling is not the contract and must not resolve.
      expect(
        resolveMobileAppSettings(buildSettings({ location_retry_count: 9 })).locationRetryCount,
      ).toBe(3);
    });
  });

  describe('numeric range validation', () => {
    it('accepts geo_fence_radius_meters across its 10-2000 range', () => {
      for (const radius of [10, 200, 2000]) {
        expect(
          resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: radius }))
            .geoFenceRadiusMeters,
        ).toBe(radius);
      }
    });

    it('falls back for a geo-fence radius below 10 metres', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: 9 }))
          .geoFenceRadiusMeters,
      ).toBe(DEFAULT_MOBILE_APP_SETTINGS.geoFenceRadiusMeters);
    });

    it('falls back for a geo-fence radius above 2000 metres', () => {
      // 5000 was legal under the old bounds — a stale row must not be trusted.
      expect(
        resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: 5000 }))
          .geoFenceRadiusMeters,
      ).toBe(DEFAULT_MOBILE_APP_SETTINGS.geoFenceRadiusMeters);
    });

    it('range-checks a numeric string too', () => {
      expect(
        resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: '9000' }))
          .geoFenceRadiusMeters,
      ).toBe(DEFAULT_MOBILE_APP_SETTINGS.geoFenceRadiusMeters);
      expect(
        resolveMobileAppSettings(buildSettings({ geo_fence_radius_meters: '1500' }))
          .geoFenceRadiusMeters,
      ).toBe(1500);
    });

    it('rejects out-of-range values for every numeric setting, and accepts its bounds', () => {
      // Table-driven over the range map, so a setting added later is covered too.
      const outcomes = Object.entries(MOBILE_APP_SETTING_RANGES).map(([name, range]) => {
        const settingName = name as keyof typeof MOBILE_APP_SETTING_RANGES;
        const key = MOBILE_APP_SETTING_KEYS[settingName];
        const fallback = DEFAULT_MOBILE_APP_SETTINGS[settingName];

        return {
          name,
          belowMin: resolveMobileAppSettings(buildSettings({ [key]: range.min - 1 }))[settingName],
          aboveMax: resolveMobileAppSettings(buildSettings({ [key]: range.max + 1 }))[settingName],
          atMin: resolveMobileAppSettings(buildSettings({ [key]: range.min }))[settingName],
          atMax: resolveMobileAppSettings(buildSettings({ [key]: range.max }))[settingName],
          fallback,
          range,
        };
      });

      expect(outcomes.length).toBe(Object.keys(MOBILE_APP_SETTING_RANGES).length);

      for (const outcome of outcomes) {
        expect({ name: outcome.name, value: outcome.belowMin }).toEqual({
          name: outcome.name,
          value: outcome.fallback,
        });
        expect({ name: outcome.name, value: outcome.aboveMax }).toEqual({
          name: outcome.name,
          value: outcome.fallback,
        });
        expect({ name: outcome.name, value: outcome.atMin }).toEqual({
          name: outcome.name,
          value: outcome.range.min,
        });
        expect({ name: outcome.name, value: outcome.atMax }).toEqual({
          name: outcome.name,
          value: outcome.range.max,
        });
      }
    });

    it('keeps every default inside its own declared range', () => {
      for (const [name, range] of Object.entries(MOBILE_APP_SETTING_RANGES)) {
        const value = DEFAULT_MOBILE_APP_SETTINGS[name as keyof typeof MOBILE_APP_SETTING_RANGES];

        expect({ name, inRange: value >= range.min && value <= range.max }).toEqual({
          name,
          inRange: true,
        });
      }
    });
  });

  describe('forward compatibility', () => {
    it('exposes a server-side setting this build does not know about', () => {
      const resolved = resolveMobileAppSettings(
        buildSettings({ some_future_setting: 'tomorrow', geo_fence_radius_meters: 300 }),
      );

      // Unknown keys survive in `values` so a backend addition needs no app release.
      expect(resolved.values['some_future_setting']).toBe('tomorrow');
      expect(resolved.geoFenceRadiusMeters).toBe(300);
    });
  });

  describe('MOBILE_APP_SETTING_KEYS', () => {
    it('has a typed field on the resolved object for every declared key', () => {
      const resolved = resolveMobileAppSettings(null);

      for (const name of Object.keys(MOBILE_APP_SETTING_KEYS)) {
        expect(resolved).toHaveProperty(name);
      }
    });

    it('keys are unique', () => {
      const keys = Object.values(MOBILE_APP_SETTING_KEYS);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
