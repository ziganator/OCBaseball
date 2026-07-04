-- Run after schema.sql/admin_auth.sql to load the current public site teams.
-- This keeps the admin user/team dropdown in sync with the static team pages.

INSERT INTO seasons (season_number, name, status)
VALUES (32, 'Season 32', 'active')
ON CONFLICT (season_number) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO teams (name, city, nickname, active)
VALUES
  ('Toronto Vixens', 'Toronto', 'Vixens', TRUE),
  ('Oakland Albatrosses', 'Oakland', 'Albatrosses', TRUE),
  ('Chicago Rogues', 'Chicago', 'Rogues', TRUE),
  ('San Francisco Spiders', 'San Francisco', 'Spiders', TRUE),
  ('Arizona Diablos', 'Arizona', 'Diablos', TRUE),
  ('California Leopards', 'California', 'Leopards', TRUE),
  ('Seattle Slayers', 'Seattle', 'Slayers', TRUE),
  ('Portland Hopheads', 'Portland', 'Hopheads', TRUE),
  ('Albuquerque Hermanos', 'Albuquerque', 'Hermanos', TRUE),
  ('Baltimore Cobras', 'Baltimore', 'Cobras', TRUE),
  ('Cleveland Highlanders', 'Cleveland', 'Highlanders', TRUE),
  ('Denver Apocalypse', 'Denver', 'Apocalypse', TRUE),
  ('Houston Hackers', 'Houston', 'Hackers', TRUE),
  ('Indiana Raiders', 'Indiana', 'Raiders', TRUE),
  ('Philadelphia Peregrines', 'Philadelphia', 'Peregrines', TRUE),
  ('Pittsburgh Bombers', 'Pittsburgh', 'Bombers', TRUE),
  ('Atlanta Anacondas', 'Atlanta', 'Anacondas', TRUE),
  ('Miami Metros', 'Miami', 'Metros', TRUE),
  ('Montreal Wolverines', 'Montreal', 'Wolverines', TRUE),
  ('New York Donkeys', 'New York', 'Donkeys', TRUE),
  ('Hartford Dark Blues', 'Hartford', 'Dark Blues', TRUE),
  ('Washington Comrades', 'Washington', 'Comrades', TRUE),
  ('San Antonio Ocatillos', 'San Antonio', 'Ocatillos', TRUE),
  ('Kansas City Miners', 'Kansas City', 'Miners', TRUE),
  ('Cincinnati Whales', 'Cincinnati', 'Whales', TRUE),
  ('San Diego Professors', 'San Diego', 'Professors', TRUE),
  ('Las Vegas Gunslingers', 'Las Vegas', 'Gunslingers', TRUE),
  ('Los Angeles Spartans', 'Los Angeles', 'Spartans', TRUE),
  ('New Orleans Nighthawks', 'New Orleans', 'Nighthawks', TRUE),
  ('Carolina Salamanders', 'Carolina', 'Salamanders', TRUE),
  ('Dallas Roadrunners', 'Dallas', 'Roadrunners', TRUE),
  ('Orlando Paladins', 'Orlando', 'Paladins', TRUE)
ON CONFLICT (name) DO UPDATE SET
  city = EXCLUDED.city,
  nickname = EXCLUDED.nickname,
  active = EXCLUDED.active,
  updated_at = CURRENT_TIMESTAMP;

WITH current_season AS (
  SELECT id FROM seasons WHERE season_number = 32
),
team_alignment (team_name, league_code, conference_code, division_code, sort_order) AS (
  VALUES
    ('Toronto Vixens', 'Keystone', 'Red', 'Seilhan', 1),
    ('Oakland Albatrosses', 'Keystone', 'Red', 'Seilhan', 2),
    ('Chicago Rogues', 'Keystone', 'Red', 'Seilhan', 3),
    ('San Francisco Spiders', 'Keystone', 'Red', 'Seilhan', 4),
    ('Arizona Diablos', 'Keystone', 'Red', 'Cox', 5),
    ('California Leopards', 'Keystone', 'Red', 'Cox', 6),
    ('Seattle Slayers', 'Keystone', 'Red', 'Cox', 7),
    ('Portland Hopheads', 'Keystone', 'Red', 'Cox', 8),
    ('Albuquerque Hermanos', 'Keystone', 'Black', 'Carranza', 9),
    ('Baltimore Cobras', 'Keystone', 'Black', 'Reasbeck', 10),
    ('Cleveland Highlanders', 'Keystone', 'Black', 'Reasbeck', 11),
    ('Denver Apocalypse', 'Keystone', 'Black', 'Carranza', 12),
    ('Houston Hackers', 'Keystone', 'Black', 'Carranza', 13),
    ('Indiana Raiders', 'Keystone', 'Black', 'Carranza', 14),
    ('Philadelphia Peregrines', 'Keystone', 'Black', 'Reasbeck', 15),
    ('Pittsburgh Bombers', 'Keystone', 'Black', 'Reasbeck', 16),
    ('Atlanta Anacondas', 'Diamond', 'Red', 'Seilhan', 17),
    ('Miami Metros', 'Diamond', 'Red', 'Seilhan', 18),
    ('Montreal Wolverines', 'Diamond', 'Red', 'Seilhan', 19),
    ('New York Donkeys', 'Diamond', 'Red', 'Seilhan', 20),
    ('Hartford Dark Blues', 'Diamond', 'Red', 'Cox', 21),
    ('Washington Comrades', 'Diamond', 'Red', 'Cox', 22),
    ('San Antonio Ocatillos', 'Diamond', 'Red', 'Cox', 23),
    ('Kansas City Miners', 'Diamond', 'Red', 'Cox', 24),
    ('Cincinnati Whales', 'Diamond', 'Black', 'Carranza', 25),
    ('San Diego Professors', 'Diamond', 'Black', 'Carranza', 26),
    ('Las Vegas Gunslingers', 'Diamond', 'Black', 'Carranza', 27),
    ('Los Angeles Spartans', 'Diamond', 'Black', 'Carranza', 28),
    ('New Orleans Nighthawks', 'Diamond', 'Black', 'Reasbeck', 29),
    ('Carolina Salamanders', 'Diamond', 'Black', 'Reasbeck', 30),
    ('Dallas Roadrunners', 'Diamond', 'Black', 'Reasbeck', 31),
    ('Orlando Paladins', 'Diamond', 'Black', 'Reasbeck', 32)
)
INSERT INTO season_team_assignments (
  season_id,
  team_id,
  league_code,
  conference_code,
  division_code,
  sort_order
)
SELECT
  current_season.id,
  teams.id,
  team_alignment.league_code,
  team_alignment.conference_code,
  team_alignment.division_code,
  team_alignment.sort_order
FROM team_alignment
CROSS JOIN current_season
JOIN teams ON teams.name = team_alignment.team_name
ON CONFLICT (season_id, team_id) DO UPDATE SET
  league_code = EXCLUDED.league_code,
  conference_code = EXCLUDED.conference_code,
  division_code = EXCLUDED.division_code,
  sort_order = EXCLUDED.sort_order;
