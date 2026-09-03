-- Mobile App Settings — remote configuration the FullScan mobile app reads at
-- startup / post-login, editable by admins from the Admin Portal.
--
-- Deliberately a typed key/value table rather than one column per setting: the
-- Admin Portal renders its form straight from these rows (label, description,
-- value_type, allowed options, min/max), so adding a new setting is a seed row
-- here and needs no server or portal code change.
CREATE TABLE IF NOT EXISTS mobile_app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('boolean', 'number', 'string', 'enum')),
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  options_json TEXT,
  min_value REAL,
  max_value REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_app_settings_category
  ON mobile_app_settings(category, sort_order);

INSERT OR IGNORE INTO mobile_app_settings
  (setting_key, setting_value, value_type, label, description, category, options_json, min_value, max_value, sort_order)
VALUES
  -- General
  ('min_supported_app_version', '1.0.0', 'string',
   'Minimum supported app version',
   'Builds older than this are asked to update before they can be used.',
   'general', NULL, NULL, NULL, 10),
  ('force_update_enabled', 'false', 'boolean',
   'Force update',
   'Block the app entirely until the user installs the minimum supported version.',
   'general', NULL, NULL, NULL, 20),
  ('default_language', 'en', 'enum',
   'Default language',
   'Language a freshly installed app starts in, before the user picks one.',
   'general', '["en","hi","te"]', NULL, NULL, 30),
  ('support_contact_number', '+911800123456', 'string',
   'Support contact number',
   'Helpdesk number shown to field executives in the app.',
   'general', NULL, NULL, NULL, 40),
  ('maintenance_mode_enabled', 'false', 'boolean',
   'Maintenance mode',
   'Show a maintenance notice and pause synchronization for every mobile client.',
   'general', NULL, NULL, NULL, 50),
  ('maintenance_message', 'Scheduled maintenance is in progress. Please try again shortly.', 'string',
   'Maintenance message',
   'Notice displayed while maintenance mode is on.',
   'general', NULL, NULL, NULL, 60),

  -- Security
  ('biometric_login_enabled', 'true', 'boolean',
   'Biometric login',
   'Allow fingerprint / face unlock as a re-login shortcut on bound devices.',
   'security', NULL, NULL, NULL, 10),
  ('mock_location_block_enabled', 'true', 'boolean',
   'Block mock locations',
   'Reject any GPS reading the OS flags as mocked, instead of only warning.',
   'security', NULL, NULL, NULL, 20),
  ('session_timeout_minutes', '720', 'number',
   'Session timeout (minutes)',
   'Idle time before the mobile session expires and re-authentication is required.',
   'security', NULL, 5, 10080, 30),
  ('max_login_attempts', '5', 'number',
   'Max login attempts',
   'Failed sign-in attempts allowed before the account is temporarily locked.',
   'security', NULL, 1, 20, 40),

  -- Evidence capture
  ('geo_fence_radius_meters', '200', 'number',
   'Geo-fence radius (metres)',
   'How far from the assignment address a capture is still accepted.',
   'evidence', NULL, 25, 5000, 10),
  ('photo_compression_quality', '80', 'number',
   'Photo compression quality',
   'JPEG quality applied to captured evidence, 1-100. Lower uploads faster.',
   'evidence', NULL, 1, 100, 20),
  ('max_photo_upload_size_mb', '5', 'number',
   'Max photo size (MB)',
   'Largest single evidence photo the app will queue for upload.',
   'evidence', NULL, 1, 50, 30),
  ('watermark_enabled', 'true', 'boolean',
   'Watermark evidence photos',
   'Burn latitude, longitude, capture date and time onto every captured photo.',
   'evidence', NULL, NULL, NULL, 40),

  -- Synchronization
  ('sync_interval_minutes', '15', 'number',
   'Sync interval (minutes)',
   'How often the app drains its offline upload queue in the background.',
   'sync', NULL, 1, 1440, 10),
  ('offline_queue_retry_limit', '5', 'number',
   'Offline retry limit',
   'Upload attempts per queued item before it is parked for manual retry.',
   'sync', NULL, 1, 25, 20),
  ('sync_on_wifi_only', 'false', 'boolean',
   'Sync on Wi-Fi only',
   'Hold evidence uploads until the device is on Wi-Fi.',
   'sync', NULL, NULL, NULL, 30);
