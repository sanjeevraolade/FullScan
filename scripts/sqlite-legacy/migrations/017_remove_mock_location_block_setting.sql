-- Removes the `mock_location_block_enabled` switch.
--
-- Blocking a mocked device location is no longer configurable: a faked position
-- always blocks the app and is always reported to /security/mock-location.
-- Leaving the row in place would let an admin switch off the one control that
-- keeps fabricated GPS evidence out of a verification.
-- Migration 014 no longer seeds the row, so this only has to clean up databases
-- created before that change.
DELETE FROM mobile_app_settings WHERE setting_key = 'mock_location_block_enabled';
