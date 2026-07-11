const DEFAULT_SEASON = "32";
const FALLBACK_SUPABASE_URL = "https://xahrxrjyowghmcwmxetc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";

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

async function fetchOptionalSupabaseJson(baseUrl, key, path, params) {
  try {
    return await fetchSupabaseJson(baseUrl, key, path, params);
  } catch (error) {
    if (error.message.includes("PGRST205")) return [];
    throw error;
  }
}

export async function onRequestGet(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

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
      fetchOptionalSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_score_runs", {
        select: "id,season_number,game_number,week_number,status,started_at,completed_at,source,metadata",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "started_at.desc",
        limit: "1"
      }),
      fetchOptionalSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_matchup_score_results", {
        select: "*",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "league_code.asc,matchup_key.asc"
      }),
      fetchOptionalSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_team_daily_score_results", {
        select: "*",
        season_number: `eq.${season}`,
        game_number: `eq.${game}`,
        week_number: `eq.${week}`,
        order: "matchup_key.asc,team_name.asc,stat_date.asc"
      }),
      fetchOptionalSupabaseJson(SUPABASE_URL, SUPABASE_ANON_KEY, "game_player_daily_score_results", {
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
