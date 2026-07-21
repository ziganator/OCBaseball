import {
  envConfig,
  getAuthenticatedUser,
  jsonResponse,
  missingConfig,
  requireAdminUser,
  signState,
  yahooAuthorizationUrl
} from "./_utils.js";

export async function onRequestPost(context) {
  const config = envConfig(context.env);
  const missing = missingConfig(config, [
    "supabaseUrl",
    "supabaseAnonKey",
    "supabaseServiceRoleKey",
    "yahooClientId",
    "yahooClientSecret",
    "yahooRedirectUri",
    "yahooStateSecret"
  ]);
  if (missing.length) {
    return jsonResponse({ error: `Missing configuration: ${missing.join(", ")}` }, 500);
  }

  try {
    const user = await getAuthenticatedUser(config, context.request);
    await requireAdminUser(config, user.id);
    const state = await signState(config, {
      userId: user.id,
      nonce: crypto.randomUUID(),
      exp: Math.floor(Date.now() / 1000) + 10 * 60
    });

    return jsonResponse({ authUrl: yahooAuthorizationUrl(config, state) });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: error.message }, 500);
  }
}
