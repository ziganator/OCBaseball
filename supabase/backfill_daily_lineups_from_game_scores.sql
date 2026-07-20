-- Backfill team_daily_lineups from stored game_player_daily_score_results.
-- Use this when weekly game scores were loaded but one or more daily lineup snapshots are missing.
-- Run after supabase/game_score_storage.sql and supabase/daily_lineups.sql.

WITH source_rows AS (
  SELECT
    team_name,
    stat_date::date AS lineup_date,
    player_name,
    upper(coalesce(roster_slot, '')) AS roster_slot,
    row_number() OVER (
      PARTITION BY team_name, stat_date, upper(coalesce(roster_slot, ''))
      ORDER BY id
    ) AS slot_index
  FROM game_player_daily_score_results
  WHERE season_number = 32
    AND player_name IS NOT NULL
    AND trim(player_name) <> ''
    AND roster_slot IS NOT NULL
),
mapped_rows AS (
  SELECT
    lower(regexp_replace(team_name, '[^a-zA-Z0-9]+', '-', 'g')) AS team_slug,
    lineup_date,
    player_name,
    CASE
      WHEN roster_slot IN ('C', '1B', '2B', '3B', 'SS') THEN roster_slot
      WHEN roster_slot = 'DH' THEN 'UTIL'
      WHEN roster_slot = 'OF' AND slot_index <= 3 THEN 'OF' || slot_index
      WHEN roster_slot = 'SP' AND slot_index <= 4 THEN 'SP' || slot_index
      WHEN roster_slot = 'RP' AND slot_index <= 2 THEN 'RP' || slot_index
      ELSE NULL
    END AS slot_code
  FROM source_rows
),
lineup_rows AS (
  SELECT
    team_slug,
    lineup_date,
    jsonb_object_agg(slot_code, player_name ORDER BY slot_code) AS lineup
  FROM mapped_rows
  WHERE slot_code IS NOT NULL
  GROUP BY team_slug, lineup_date
)
INSERT INTO team_daily_lineups (team_slug, lineup_date, lineup, updated_at)
SELECT
  team_slug,
  lineup_date,
  lineup,
  NOW()
FROM lineup_rows
ON CONFLICT (team_slug, lineup_date) DO UPDATE SET
  lineup = EXCLUDED.lineup,
  updated_at = NOW();
