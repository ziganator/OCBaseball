import {
  envConfig,
  exchangeYahooCode,
  fetchYahooProfile,
  htmlResponse,
  missingConfig,
  requireAdminUser,
  saveConnection,
  verifyState
} from "./_utils.js";

function redirectHtml(target, message) {
  const safeTarget = target.replace(/"/g, "%22");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${safeTarget}">
    <title>Yahoo Connection</title>
  </head>
  <body>
    <p>${message}</p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`;
}

export async function onRequestGet(context) {
  const config = envConfig(context.env);
  const missing = missingConfig(config, [
    "supabaseUrl",
    "supabaseServiceRoleKey",
    "yahooClientId",
    "yahooClientSecret",
    "yahooRedirectUri",
    "yahooStateSecret",
    "yahooTokenEncryptionKey"
  ]);
  if (missing.length) {
    return htmlResponse(redirectHtml(`/admin-yahoo.html?error=${encodeURIComponent(`Missing configuration: ${missing.join(", ")}`)}`, "Yahoo is missing configuration."), 500);
  }

  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const yahooError = url.searchParams.get("error");

  if (yahooError) {
    return htmlResponse(redirectHtml(`/admin-yahoo.html?error=${encodeURIComponent(yahooError)}`, "Yahoo denied the connection."), 400);
  }

  if (!code || !state) {
    return htmlResponse(redirectHtml("/admin-yahoo.html?error=missing_oauth_code", "Yahoo did not return an OAuth code."), 400);
  }

  try {
    const payload = await verifyState(config, state);
    await requireAdminUser(config, payload.userId);
    const tokenData = await exchangeYahooCode(config, code);
    const profile = tokenData.access_token ? await fetchYahooProfile(tokenData.access_token) : null;
    await saveConnection(config, payload.userId, tokenData, profile);
    return htmlResponse(redirectHtml("/admin-yahoo.html?connected=1", "Yahoo connected. Returning to Owners Club Baseball."));
  } catch (error) {
    return htmlResponse(redirectHtml(`/admin-yahoo.html?error=${encodeURIComponent(error.message)}`, "Could not connect Yahoo."), 500);
  }
}
