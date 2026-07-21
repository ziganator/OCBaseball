import { getSession, requireSession, signOut } from "./auth.js";

const statusEl = document.querySelector("#yahoo-status");
const summaryEl = document.querySelector("#yahoo-connection-summary");
const leaguesEl = document.querySelector("#yahoo-leagues");
const connectButton = document.querySelector("#connect-yahoo-button");
const loadLeaguesButton = document.querySelector("#load-leagues-button");
const refreshButton = document.querySelector("#refresh-yahoo-button");
const logoutButton = document.querySelector("#logout-button");

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderSummary(data = {}) {
  const missing = data.missing?.length ? data.missing.join(", ") : "";
  const statusText = data.configured
    ? (data.connected ? "Connected" : "Ready to connect")
    : "Missing setup";
  const items = [
    ["Status", statusText],
    ["Logged In As", data.user?.email || "Unknown"],
    ["Yahoo GUID", data.yahooGuid || "Not connected"],
    ["Scopes", data.scopes || "Not connected"],
    ["Token Expires", formatDate(data.expiresAt)],
    ["Last Updated", formatDate(data.updatedAt)]
  ];

  summaryEl.innerHTML = `
    ${items.map(([label, value]) => `
      <div class="yahoo-status-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("")}
    ${missing ? `<p class="admin-note yahoo-status-wide">Missing: ${escapeHtml(missing)}</p>` : ""}
  `;
}

function renderLeagues(leagues = []) {
  if (!leagues.length) {
    leaguesEl.innerHTML = `<p class="admin-note">No Yahoo MLB leagues came back for this Yahoo account.</p>`;
    return;
  }

  leaguesEl.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>League</th>
            <th>Key</th>
            <th>Season</th>
            <th>Teams</th>
            <th>Scoring</th>
          </tr>
        </thead>
        <tbody>
          ${leagues.map((league) => `
            <tr>
              <td>
                <strong>${escapeHtml(league.name || "Unnamed League")}</strong>
                ${league.url ? `<span><a href="${escapeHtml(league.url)}" target="_blank" rel="noreferrer">Open in Yahoo</a></span>` : ""}
              </td>
              <td>${escapeHtml(league.leagueKey)}</td>
              <td>${escapeHtml(league.season)}</td>
              <td>${escapeHtml(league.numTeams)}</td>
              <td>${escapeHtml(league.scoringType)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function authFetch(path, options = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    window.location.assign(`/login.html?next=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("Login required.");
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `${path} returned ${response.status}`);
  }
  return body;
}

async function loadStatus() {
  setStatus("Checking Yahoo connection...");
  const data = await authFetch("/api/yahoo/status", { cache: "no-store" });
  renderSummary(data);

  if (!data.configured) {
    setStatus("Yahoo setup is missing one or more Cloudflare variables.", "error");
    connectButton.disabled = true;
    loadLeaguesButton.disabled = true;
    return data;
  }

  connectButton.disabled = false;
  loadLeaguesButton.disabled = !data.connected;
  setStatus(data.connected ? "Yahoo is connected." : "Yahoo is ready to connect.");
  return data;
}

async function connectYahoo() {
  setStatus("Starting Yahoo authorization...");
  const data = await authFetch("/api/yahoo/start", { method: "POST" });
  if (!data.authUrl) throw new Error("Yahoo authorization URL was not returned.");
  window.location.assign(data.authUrl);
}

async function loadLeagues() {
  setStatus("Loading Yahoo MLB leagues...");
  leaguesEl.innerHTML = `<p class="admin-note">Loading leagues...</p>`;
  const data = await authFetch("/api/yahoo/leagues", { cache: "no-store" });
  renderLeagues(data.leagues || []);
  setStatus(`Loaded ${(data.leagues || []).length} Yahoo MLB league${(data.leagues || []).length === 1 ? "" : "s"}.`);
}

try {
  const session = await requireSession();
  if (session) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      setStatus("Yahoo connected. Checking status...");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      setStatus(`Yahoo connection failed: ${params.get("error")}`, "error");
      window.history.replaceState({}, "", window.location.pathname);
    }

    await loadStatus();
  }
} catch (error) {
  setStatus(error.message, "error");
}

connectButton.addEventListener("click", () => {
  connectYahoo().catch((error) => setStatus(`Could not start Yahoo: ${error.message}`, "error"));
});
loadLeaguesButton.addEventListener("click", () => {
  loadLeagues().catch((error) => setStatus(`Could not load leagues: ${error.message}`, "error"));
});
refreshButton.addEventListener("click", () => {
  loadStatus().catch((error) => setStatus(`Refresh failed: ${error.message}`, "error"));
});
logoutButton.addEventListener("click", signOut);
