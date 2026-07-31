const DEFAULT_SEASON = "32";
const FALLBACK_SUPABASE_URL = "https://xahrxrjyowghmcwmxetc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";

async function fetchRows(baseUrl, key, table, params) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" } });
  if (!response.ok) throw new Error(`${table} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function onRequestGet(context) {
  const baseUrl = context.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = context.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  const requestUrl = new URL(context.request.url);
  const season = requestUrl.searchParams.get("season") || DEFAULT_SEASON;
  const team = String(requestUrl.searchParams.get("team") || "").trim().toUpperCase();
  if (!team) return Response.json({ error: "A team name is required." }, { status: 400 });

  try {
    const [matchups, runs] = await Promise.all([
      fetchRows(baseUrl, key, "game_matchup_score_results", {
        select: "game_number,week_number,away_team_name,home_team_name,away_score,home_score",
        season_number: `eq.${season}`,
        or: `(away_team_name.eq.${team},home_team_name.eq.${team})`,
        order: "week_number.asc"
      }),
      fetchRows(baseUrl, key, "game_score_runs", {
        select: "game_number,week_number,status,completed_at,metadata",
        season_number: `eq.${season}`,
        order: "week_number.asc,started_at.desc"
      })
    ]);
    const latestRunByWeek = new Map();
    for (const run of runs) if (!latestRunByWeek.has(run.week_number)) latestRunByWeek.set(run.week_number, run);
    return Response.json({ data: matchups.map((matchup) => ({ ...matchup, run: latestRunByWeek.get(matchup.week_number) || null })) });
  } catch (error) {
    return Response.json({ error: "Could not load the team schedule.", detail: error.message }, { status: 502 });
  }
}
