-- Read models for the Cloudflare website.
-- Run after schema.sql.

CREATE OR REPLACE VIEW public_current_standings AS
SELECT
  s.season_number,
  s.name AS season_name,
  sta.league_code,
  sta.conference_code,
  sta.division_code,
  t.id AS team_id,
  t.name AS team_name,
  sr.wins,
  sr.losses,
  sr.win_pct,
  sr.rank_in_group,
  sr.offense_points,
  sr.pitching_points,
  sr.total_points,
  sr.plus_minus,
  sr.pct_to_average,
  sr.division_wins,
  sr.division_losses,
  sr.conference_wins,
  sr.conference_losses,
  sr.average_per_week,
  ss.snapshot_at
FROM standings_rows sr
JOIN standings_snapshots ss ON ss.id = sr.snapshot_id
JOIN seasons s ON s.id = ss.season_id
JOIN season_team_assignments sta ON sta.id = sr.season_team_assignment_id
JOIN teams t ON t.id = sta.team_id
WHERE ss.is_current = TRUE;

CREATE OR REPLACE VIEW public_game_results AS
SELECT
  s.season_number,
  g.game_number,
  g.matchup_number,
  g.league_code,
  g.at_code,
  g.status,
  t.name AS team_name,
  gtr.result,
  gtr.score,
  gtr.lead_margin,
  gtr.offense_points,
  gtr.pitching_points,
  gtr.infield_points,
  gtr.outfield_points,
  gtr.dh_points,
  gtr.starting_pitching_points,
  gtr.relief_pitching_points,
  gtr.psr,
  gtr.home_away
FROM game_team_results gtr
JOIN games g ON g.id = gtr.game_id
JOIN seasons s ON s.id = g.season_id
JOIN teams t ON t.id = gtr.team_id;

GRANT SELECT ON public_current_standings TO anon, authenticated;
GRANT SELECT ON public_game_results TO anon, authenticated;
