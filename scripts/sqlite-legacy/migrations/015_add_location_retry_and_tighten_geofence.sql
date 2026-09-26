-- Adds the location retry parameter and tightens the geo-fence radius bounds.
--
-- Note on the key: `locationRetryCount` is camelCase, unlike the snake_case keys
-- around it. That is the param name the mobile contract specifies, and
-- `setting_key` is what goes on the wire, so it is stored verbatim rather than
-- normalised to `location_retry_count`.
INSERT OR IGNORE INTO mobile_app_settings
  (setting_key, setting_value, value_type, label, description, category, options_json, min_value, max_value, sort_order)
VALUES
  ('locationRetryCount', '3', 'number',
   'Location retry count',
   'How many times the app re-attempts a GPS fix before giving up on a capture.',
   'evidence', NULL, 3, 10, 15);

-- Geo-fence radius: 25..5000 -> 10..2000 metres.
UPDATE mobile_app_settings
SET min_value = 10, max_value = 2000
WHERE setting_key = 'geo_fence_radius_meters';

-- An existing value may now sit outside the tightened range (the old bounds were
-- wider). Pull it back to the nearest legal value so the app is never served a
-- radius the admin form would refuse to save.
UPDATE mobile_app_settings
SET setting_value = '10', updated_at = datetime('now')
WHERE setting_key = 'geo_fence_radius_meters' AND CAST(setting_value AS REAL) < 10;

UPDATE mobile_app_settings
SET setting_value = '2000', updated_at = datetime('now')
WHERE setting_key = 'geo_fence_radius_meters' AND CAST(setting_value AS REAL) > 2000;
