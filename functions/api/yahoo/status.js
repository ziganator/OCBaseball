import {
  envConfig,
  defaultYahooRedirectUri,
  getAuthenticatedUser,
  jsonResponse,
  loadConnection,
  missingConfig,
  redirectUriHostMismatch,
  requireAdminUser
} from "./_utils.js";

export async function onRequestGet(context) {
  const config = envConfig(context.env);
  const currentCallbackUri = defaultYahooRedirectUri(context.request);
  const mismatch = redirectUriHostMismatch(config, context.request);

  try {
    const user = await getAuthenticatedUser(config, context.request);
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
      return jsonResponse({
        configured: false,
        connected: false,
        missing,
        redirectUri: config.yahooRedirectUri || currentCallbackUri,
        currentCallbackUri,
        redirectUriMatchesCurrentHost: !mismatch,
        user: {
          id: user.id,
          email: user.email || ""
        }
      });
    }

    await requireAdminUser(config, user.id);
    const connection = await loadConnection(config, user.id);
    return jsonResponse({
      configured: true,
      connected: Boolean(connection),
      yahooGuid: connection?.yahoo_guid || "",
      scopes: connection?.scopes || "",
      redirectUri: config.yahooRedirectUri || currentCallbackUri,
      currentCallbackUri,
      redirectUriMatchesCurrentHost: !mismatch,
      expiresAt: connection?.expires_at || null,
      profile: connection?.profile || null,
      updatedAt: connection?.updated_at || null,
      user: {
        id: user.id,
        email: user.email || ""
      }
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: error.message }, 500);
  }
}
