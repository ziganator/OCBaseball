import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseBrowserConfig } from "./supabase-browser-config.js";

let clientPromise;

async function loadConfig() {
  let configEndpointReturnedHtml = false;

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      return response.json();
    }

    if (response.ok && contentType.includes("text/html")) {
      configEndpointReturnedHtml = true;
    }
  } catch {
    // Static previews do not run Cloudflare Pages Functions.
  }

  if (supabaseBrowserConfig.supabaseUrl && supabaseBrowserConfig.supabaseAnonKey) {
    return supabaseBrowserConfig;
  }

  if (configEndpointReturnedHtml) {
    throw new Error("Supabase config is missing. This manual Cloudflare upload is not running /api/config, so add your Project URL and publishable/anon key to public/supabase-browser-config.js.");
  }

  throw new Error("Supabase config is missing. Check Cloudflare environment variables or public/supabase-browser-config.js.");
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = loadConfig().then(({ supabaseUrl, supabaseAnonKey }) => {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase browser config is missing.");
      }

      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      });
    });
  }

  return clientPromise;
}

export async function getSession() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`/login.html?next=${next}`);
    return null;
  }

  return session;
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  window.location.assign("/login.html");
}
