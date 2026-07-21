const FALLBACK_SUPABASE_URL = "https://xahrxrjyowghmcwmxetc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_jEBLgV4-_qoI3bVPQ7_pxQ_O-2yTGfV";
const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_USERINFO_URL = "https://api.login.yahoo.com/openid/v1/userinfo";
const YAHOO_FANTASY_ROOT = "https://fantasysports.yahooapis.com/fantasy/v2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function envConfig(env) {
  return {
    supabaseUrl: env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    yahooClientId: env.YAHOO_CLIENT_ID || "",
    yahooClientSecret: env.YAHOO_CLIENT_SECRET || "",
    yahooRedirectUri: env.YAHOO_REDIRECT_URI || "",
    yahooScopes: env.YAHOO_SCOPES || "fspt-r",
    yahooStateSecret: env.YAHOO_OAUTH_STATE_SECRET || env.YAHOO_CLIENT_SECRET || "",
    yahooTokenEncryptionKey: env.YAHOO_TOKEN_ENCRYPTION_KEY || env.YAHOO_CLIENT_SECRET || ""
  };
}

export function missingConfig(config, names) {
  return names.filter((name) => !config[name]);
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function base64UrlEncode(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function sha256Key(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function signState(config, payload) {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmac(config.yahooStateSecret, body));
  return `${body}.${signature}`;
}

export async function verifyState(config, state) {
  const [body, signature] = String(state || "").split(".");
  if (!body || !signature) throw new Error("Missing OAuth state.");
  const expected = base64UrlEncode(await hmac(config.yahooStateSecret, body));
  if (expected !== signature) throw new Error("Invalid OAuth state.");
  const payload = JSON.parse(decoder.decode(base64UrlDecode(body)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("OAuth state expired.");
  }
  return payload;
}

export async function encryptJson(config, value) {
  if (!config.yahooTokenEncryptionKey) throw new Error("Missing Yahoo token encryption key.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sha256Key(config.yahooTokenEncryptionKey);
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    alg: "A256GCM",
    iv: base64UrlEncode(iv),
    data: base64UrlEncode(encrypted)
  };
}

export async function decryptJson(config, encryptedValue) {
  if (!encryptedValue?.iv || !encryptedValue?.data) return null;
  const key = await sha256Key(config.yahooTokenEncryptionKey);
  const iv = base64UrlDecode(encryptedValue.iv);
  const data = base64UrlDecode(encryptedValue.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(decoder.decode(decrypted));
}

export async function getAuthenticatedUser(config, request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Response(JSON.stringify({ error: "Missing Supabase session token." }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const response = await fetch(new URL("/auth/v1/user", config.supabaseUrl), {
    headers: {
      apikey: config.supabaseAnonKey,
      authorization
    }
  });

  if (!response.ok) {
    throw new Response(JSON.stringify({ error: "Invalid Supabase session token." }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  return response.json();
}

export async function supabaseRequest(config, path, options = {}) {
  if (!config.supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  const url = new URL(`/rest/v1/${path}`, config.supabaseUrl);
  for (const [key, value] of Object.entries(options.params || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function requireAdminUser(config, userId) {
  const rows = await supabaseRequest(config, "admin_users", {
    params: {
      select: "user_id,is_commissioner",
      user_id: `eq.${userId}`,
      limit: "1"
    }
  });
  if (!rows?.length) {
    throw new Response(JSON.stringify({ error: "Admin access is required." }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }
  return rows[0];
}

export async function loadConnection(config, userId) {
  const rows = await supabaseRequest(config, "yahoo_oauth_connections", {
    params: {
      select: "id,user_id,yahoo_guid,scopes,token_type,access_token,refresh_token,expires_at,profile,metadata,updated_at",
      user_id: `eq.${userId}`,
      limit: "1"
    }
  });
  return rows?.[0] || null;
}

export async function saveConnection(config, userId, tokenData, profile = null) {
  const now = new Date();
  const expiresIn = Number(tokenData.expires_in || 3600);
  const expiresAt = new Date(now.getTime() + Math.max(60, expiresIn - 60) * 1000).toISOString();
  const existing = await loadConnection(config, userId);
  const encryptedAccessToken = await encryptJson(config, tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token
    ? await encryptJson(config, tokenData.refresh_token)
    : existing?.refresh_token || null;

  const rows = await supabaseRequest(config, "yahoo_oauth_connections", {
    method: "POST",
    params: { on_conflict: "user_id" },
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: [{
      user_id: userId,
      yahoo_guid: tokenData.xoauth_yahoo_guid || profile?.sub || existing?.yahoo_guid || null,
      scopes: tokenData.scope || existing?.scopes || config.yahooScopes,
      token_type: tokenData.token_type || "bearer",
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt,
      profile: profile || existing?.profile || {},
      metadata: {
        connectedAt: existing?.metadata?.connectedAt || now.toISOString(),
        lastTokenRefreshAt: now.toISOString()
      },
      updated_at: now.toISOString()
    }]
  });
  return rows?.[0] || null;
}

export function yahooAuthorizationUrl(config, state) {
  const url = new URL(YAHOO_AUTH_URL);
  url.searchParams.set("client_id", config.yahooClientId);
  url.searchParams.set("redirect_uri", config.yahooRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.yahooScopes);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeYahooCode(config, code) {
  return yahooTokenRequest(config, {
    grant_type: "authorization_code",
    redirect_uri: config.yahooRedirectUri,
    code
  });
}

export async function refreshYahooConnection(config, connection) {
  const refreshToken = await decryptJson(config, connection.refresh_token);
  if (!refreshToken) throw new Error("Yahoo connection does not have a refresh token.");
  const tokenData = await yahooTokenRequest(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  return saveConnection(config, connection.user_id, tokenData, connection.profile);
}

async function yahooTokenRequest(config, fields) {
  const body = new URLSearchParams(fields);
  const credentials = btoa(`${config.yahooClientId}:${config.yahooClientSecret}`);
  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Yahoo token exchange returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function fetchYahooProfile(accessToken) {
  try {
    const response = await fetch(YAHOO_USERINFO_URL, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function validYahooConnection(config, userId) {
  let connection = await loadConnection(config, userId);
  if (!connection) return null;
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiresAt && expiresAt < Date.now() + 5 * 60 * 1000) {
    connection = await refreshYahooConnection(config, connection);
  }
  return connection;
}

export async function yahooFantasyRequest(config, connection, path) {
  const accessToken = await decryptJson(config, connection.access_token);
  const url = new URL(path.replace(/^\//, ""), `${YAHOO_FANTASY_ROOT}/`);
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Fantasy API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
