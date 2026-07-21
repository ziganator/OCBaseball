import {
  envConfig,
  getAuthenticatedUser,
  jsonResponse,
  missingConfig,
  redirectUriHostMismatch,
  requireAdminUser,
  signState,
  yahooConfigForRequest,
  yahooAuthorizationUrl
} from "./_utils.js";

export async function onRequestPost(context) {
  const baseConfig = envConfig(context.env);
  const mismatch = redirectUriHostMismatch(baseConfig, context.request);
  if (mismatch) {
    return jsonResponse({
      error: `YAHOO_REDIRECT_URI is set to ${mismatch.configured}, but this site is running at ${new URL(context.request.url).origin}. Update Yahoo and Cloudflare to use ${mismatch.expected}.`
    }, 400);
  }

  const config = yahooConfigForRequest(baseConfig, context.request);
  const missing = missingConfig(config, [
    "supabaseUrl",
    "supabaseAnonKey",
    "supabaseServiceRoleKey",
    "yahooClientId",
    "yahooClientSecret",
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
