-- Add device binding columns to field_executives
-- device_id: stores the unique device identifier for the logged-in device
-- device_details: stores complete device information in JSON format
ALTER TABLE field_executives ADD COLUMN device_id TEXT;
ALTER TABLE field_executives ADD COLUMN device_details TEXT;

CREATE INDEX IF NOT EXISTS idx_field_executives_device_id ON field_executives(device_id);
