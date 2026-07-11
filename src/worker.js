import { onRequestGet as config } from "../functions/api/config.js";
import { onRequestGet as gameResults } from "../functions/api/game-results.js";
import { onRequestGet as standings } from "../functions/api/standings.js";
import { onRequestGet as teamSiteData } from "../functions/api/team-site-data.js";

const routes = new Map([
  ["/api/config", config],
  ["/api/game-results", gameResults],
  ["/api/game1-results", gameResults],
  ["/api/standings", standings],
  ["/api/team-site-data", teamSiteData]
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const handler = routes.get(url.pathname);
    if (handler) {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { allow: "GET" }
        });
      }
      return handler({ request, env });
    }

    return env.SITE_ASSETS.fetch(request);
  }
};
