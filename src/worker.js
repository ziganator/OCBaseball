import { onRequestGet as config } from "../functions/api/config.js";
import { onRequestGet as gameResults } from "../functions/api/game-results.js";
import { onRequestGet as standings } from "../functions/api/standings.js";
import { onRequestGet as teamSiteData } from "../functions/api/team-site-data.js";
import { onRequestGet as yahooCallback } from "../functions/api/yahoo/callback.js";
import { onRequestGet as yahooLeagues } from "../functions/api/yahoo/leagues.js";
import { onRequestPost as yahooStart } from "../functions/api/yahoo/start.js";
import { onRequestGet as yahooStatus } from "../functions/api/yahoo/status.js";

const routes = new Map([
  ["GET /api/config", config],
  ["GET /api/game-results", gameResults],
  ["GET /api/game1-results", gameResults],
  ["GET /api/standings", standings],
  ["GET /api/team-site-data", teamSiteData],
  ["GET /api/yahoo/callback", yahooCallback],
  ["GET /api/yahoo/leagues", yahooLeagues],
  ["GET /api/yahoo/status", yahooStatus],
  ["POST /api/yahoo/start", yahooStart]
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const handler = routes.get(`${request.method} ${url.pathname}`);
    if (handler) {
      return handler({ request, env });
    }

    const pathHasApiHandler = [...routes.keys()].some((route) => route.endsWith(` ${url.pathname}`));
    if (pathHasApiHandler) {
      const allowed = [...routes.keys()]
        .filter((route) => route.endsWith(` ${url.pathname}`))
        .map((route) => route.split(" ")[0])
        .join(", ");
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: allowed }
      });
    }

    return env.SITE_ASSETS.fetch(request);
  }
};
