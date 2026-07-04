export default {
  async fetch(request, env) {
    return env.SITE_ASSETS.fetch(request);
  }
};
