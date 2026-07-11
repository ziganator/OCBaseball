const DEFAULT_SEASON = "32";

function supabaseHeaders(key) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    accept: "application/json"
  };
}

async function fetchSupabaseJson(baseUrl, key, path, params) {
  const url = new URL(`/rest/v1/${path}`, baseUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const response = await fetch(url, { headers: supabaseHeaders(key) });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function onRequestGet(context) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = context.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" },
      { status: 500 }
    );
  }

  const requestUrl = new URL(context.request.url);
  const season = requestUrl.searchParams.get("season") || DEFAULT_SEASON;
  const week = requestUrl.searchParams.get("week") || "1";
  const game = requestUrl.searchParams.get("game") || week;

  try {
    const [runs, matchups, teams, players] = await Promise.all([
      fetchSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_score_runs", {
        select: "id,season_number,game_number,week_number,status,started_at,completed_at,source,metadata",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "started_at.desc",
        limit: "1"
      }),
      fetchSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_matchup_score_results", {
        select: "*",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "league_code.asc,matchup_key.asc"
      }),
      fetchSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_team_daily_score_results", {
        select: "*",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "matchup_key.asc,team_name.asc,stat_date.asc"
      }),
      fetchSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_player_daily_score_results", {
        select: "*",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "matchup_key.asc,team_name.asc,player_name.asc,stat_date.asc"
      })
    ]);

    return Response.json({
      data: {
        season: Number(season),
        game: Number(game),
        week: Number(week),
        run: runs[0] || null,
        matchups,
        teams,
        players
      }
    });
  } catch (error) {
    return Response.json(
      { error: "Could not load stored game results", detail: error.message },
      { status: 502 }
    );
  }
}
