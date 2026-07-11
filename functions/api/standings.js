export async function onRequestGet(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL || "https://xahrxrjyowghmcwmxetc.supabase.co";
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY || "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" },
      { status: 500 }
    );
  }

  const url = new URL("/rest/v1/public_current_standings", SUPABASE_URL);
  url.searchParams.set(
    "select",
    [
      "season_number",
      "league_code",
      "conference_code",
      "division_code",
      "team_name",
      "wins",
      "losses",
      "win_pct",
      "rank_in_group",
      "offense_points",
      "pitching_points",
      "total_points",
      "plus_minus",
      "average_per_week"
    ].join(",")
  );
  url.searchParams.set("order", "league_code.asc,conference_code.asc,division_code.asc,rank_in_group.asc,team_name.asc");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    return Response.json(
      { error: "Supabase request failed", status: response.status, detail: await response.text() },
      { status: 502 }
    );
  }

  return Response.json({ data: await response.json() });
}
