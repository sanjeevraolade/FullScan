-- Puts every non-uitest case component in Hyderabad, Telangana: address text, location and
-- target coordinates are all derived from the same locality, so what the app shows and where
-- the map points finally agree. Previously the seeded backlog mixed Bangalore/Noida/Pune/Nagpur
-- addresses, placeholder text ("area, city, mandal"), 17 blank addresses and 535 blank
-- locations, with coordinates scattered across India or left at the 0,0 "not geocoded yet"
-- sentinel (which the app used to geocode from the address).
--
-- Every locality below sits within ~13 km of the test area at 17.493971, 78.324914, so the whole
-- backlog is reachable while testing distance, directions and geofence behaviour on a device there.
--
-- Placement is derived from rowid rather than random(), so rebuilding the database puts every
-- component back at the same address and coordinates. House numbers vary by rowid; a sub-kilometre
-- jitter (+/-0.008 degrees, ~890 m) keeps components in one locality from stacking on one pin.
--
-- uitest components are excluded: migration 018 places them deliberately within 5 km of the centre.
CREATE TEMP TABLE hyderabad_localities (
  slot INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  street TEXT NOT NULL,
  pin TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL
);
INSERT INTO hyderabad_localities (slot, name, street, pin, latitude, longitude) VALUES
  (0,  'Miyapur',         'Beside Miyapur Metro Station, Mythri Nagar',      '500049', 17.4948, 78.3578),
  (1,  'Chanda Nagar',    'Near Chanda Nagar Railway Station, Pragathi Nagar', '500050', 17.4924, 78.3200),
  (2,  'Nizampet',        'Near Nizampet Cross Roads, JP Nagar',             '500090', 17.5089, 78.3873),
  (3,  'Bachupally',      'Near Bachupally X Roads, Gandimaisamma Road',     '500090', 17.5449, 78.3406),
  (4,  'Kukatpally',      'Near Forum Sujana Mall, Moosapet',                '500072', 17.4849, 78.4138),
  (5,  'KPHB Colony',     'Road No. 1, KPHB Phase 6',                        '500085', 17.4948, 78.3996),
  (6,  'Hafeezpet',       'Near Hafeezpet Railway Station, Kondapur Road',   '500049', 17.4806, 78.3574),
  (7,  'Lingampally',     'Near Lingampally Bus Depot, BHEL Road',           '500019', 17.4930, 78.3170),
  (8,  'Beeramguda',      'Near Beeramguda X Roads, Ramachandrapuram',       '502032', 17.5060, 78.3000),
  (9,  'Ameenpur',        'Near Ameenpur Lake, Vasantha Nagar',              '502032', 17.5350, 78.3200),
  (10, 'Patancheru',      'Near Patancheru Bus Station, Muthangi Road',      '502319', 17.5300, 78.2650),
  (11, 'Tellapur',        'Near Tellapur Junction, Nallagandla Road',        '502032', 17.4850, 78.2960),
  (12, 'Gachibowli',      'Near DLF Cyber City, Indira Nagar',               '500032', 17.4401, 78.3489),
  (13, 'Kondapur',        'Near Kondapur Bus Stop, Sri Sai Nagar',           '500084', 17.4615, 78.3644),
  (14, 'Madhapur',        'Near Durgam Cheruvu, Ayyappa Society',            '500081', 17.4483, 78.3915),
  (15, 'Serilingampally', 'Near Serilingampally Bus Stop, Gandhi Nagar',     '500019', 17.4890, 78.3290);

UPDATE case_components
SET
  address =
    'H.No. ' || (rowid % 90 + 10) || '-' || (rowid % 40 + 1) || '/' || (rowid % 9 + 1) || ', '
    || (SELECT street FROM hyderabad_localities WHERE slot = case_components.rowid % 16) || ', '
    || (SELECT name FROM hyderabad_localities WHERE slot = case_components.rowid % 16)
    || ', Hyderabad, Telangana '
    || (SELECT pin FROM hyderabad_localities WHERE slot = case_components.rowid % 16),
  location =
    (SELECT name FROM hyderabad_localities WHERE slot = case_components.rowid % 16)
    || ', Hyderabad, Telangana',
  target_latitude = round(
    (SELECT latitude FROM hyderabad_localities WHERE slot = case_components.rowid % 16)
    + ((case_components.rowid / 16) % 9 - 4) * 0.002, 6),
  target_longitude = round(
    (SELECT longitude FROM hyderabad_localities WHERE slot = case_components.rowid % 16)
    + ((case_components.rowid / 144) % 9 - 4) * 0.002, 6)
WHERE id NOT LIKE 'comp-uitest-%';

DROP TABLE hyderabad_localities;
