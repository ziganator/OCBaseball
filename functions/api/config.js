export async function onRequestGet(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL || "https://xahrxrjyowghmcwmxetc.supabase.co";
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY || "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json(
      { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" },
      { status: 500 }
    );
  }

  return Response.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
}
