import {
  envConfig,
  getAuthenticatedUser,
  jsonResponse,
  missingConfig,
  requireAdminUser,
  validYahooConnection,
  yahooConfigForRequest,
  yahooFantasyRequest
} from "./_utils.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scalarEntries(source) {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => (
      value === null || ["string", "number", "boolean"].includes(typeof value)
    ))
  );
}

function leagueFromArray(items) {
  const league = {};

  for (const item of items) {
    if (Array.isArray(item)) {
      for (const nested of item) {
        if (isPlainObject(nested)) {
          Object.assign(league, scalarEntries(nested));
        }
      }
      continue;
    }

    if (isPlainObject(item)) {
      Object.assign(league, scalarEntries(item));
    }
  }

  return league.league_key ? league : null;
}

function collectLeagueObjects(value, output = []) {
  if (Array.isArray(value)) {
    const league = leagueFromArray(value);
    if (league) output.push(league);
    value.forEach((item) => collectLeagueObjects(item, output));
    return output;
  }

  if (!isPlainObject(value)) return output;

  if (value.league_key) {
    output.push(scalarEntries(value));
  }

  Object.entries(value).forEach(([key, item]) => {
    if (key === "league") {
      const league = Array.isArray(item) ? leagueFromArray(item) : item;
      if (league?.league_key) output.push(scalarEntries(league));
    }
    collectLeagueObjects(item, output);
  });

  return output;
}

function normalizeLeagues(raw) {
  const unique = new Map();
  for (const league of collectLeagueObjects(raw)) {
    if (!league.league_key) continue;
    unique.set(league.league_key, {
      leagueKey: league.league_key,
      leagueId: league.league_id || "",
      name: league.name || "",
      url: league.url || "",
      season: league.season || "",
      numTeams: league.num_teams || "",
      gameKey: league.game_key || "",
      draftStatus: league.draft_status || "",
      scoringType: league.scoring_type || ""
    });
  }
  return [...unique.values()].sort((a, b) => (
    String(b.season || "").localeCompare(String(a.season || ""))
    || String(a.name || "").localeCompare(String(b.name || ""))
  ));
}

export async function onRequestGet(context) {
  const config = yahooConfigForRequest(envConfig(context.env), context.request);
  const missing = missingConfig(config, [
    "supabaseUrl",
    "supabaseAnonKey",
    "supabaseServiceRoleKey",
    "yahooClientId",
    "yahooClientSecret",
    "yahooStateSecret",
    "yahooTokenEncryptionKey"
  ]);
  if (missing.length) {
    return jsonResponse({ error: `Missing configuration: ${missing.join(", ")}` }, 500);
  }

  try {
    const user = await getAuthenticatedUser(config, context.request);
    await requireAdminUser(config, user.id);
    const connection = await validYahooConnection(config, user.id);
    if (!connection) {
      return jsonResponse({ error: "Yahoo is not connected yet." }, 404);
    }

    const raw = await yahooFantasyRequest(config, connection, "users;use_login=1/games;game_codes=mlb/leagues");
    return jsonResponse({
      leagues: normalizeLeagues(raw),
      yahooGuid: connection.yahoo_guid || "",
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: error.message }, 500);
  }
}
