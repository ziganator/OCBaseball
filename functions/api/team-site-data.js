const FALLBACK_SUPABASE_URL = "https://xahrxrjyowghmcwmxetc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";

export async function onRequestGet(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  const url = new URL("/rest/v1/team_site_data", SUPABASE_URL);
  url.searchParams.set("select", "site_data,updated_at");
  url.searchParams.set("data_key", "eq.team-data");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("PGRST205")) {
      return Response.json({ data: null });
    }
    return Response.json({ error: "Could not load team site data", detail }, { status: 502 });
  }

  const rows = await response.json();
  return Response.json({ data: rows[0]?.site_data || null, updatedAt: rows[0]?.updated_at || null });
}
