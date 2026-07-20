import { getSupabaseClient, requireSession } from "./auth.js";

const statusEl = document.querySelector("#my-team-status");
const cardEl = document.querySelector("#my-team-card");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lineupUrl(teamName) {
  const slug = slugify(teamName);
  if (slug === "cleveland-highlanders") return "/highlanders-lineup.html";
  return "";
}

function teamUrl(teamName) {
  return `/teams/${slugify(teamName)}/`;
}

function renderAssignment(row) {
  const lineupHref = lineupUrl(row.team_name);
  if (lineupHref) {
    window.location.replace(lineupHref);
    return;
  }

  statusEl.textContent = row.team_name
    ? `${row.team_name} is assigned to your account.`
    : "Your account is active, but it is not assigned to a team yet.";

  if (!row.team_name) {
    cardEl.innerHTML = `
      <h2>No Team Assigned</h2>
      <p class="admin-note">Ask the commissioner to assign your account to a team.</p>
    `;
    return;
  }

  cardEl.innerHTML = `
    <h2>${escapeHtml(row.team_name)}</h2>
    <p class="admin-note">${escapeHtml(row.league_code || "League")} owner tools</p>
    <div class="admin-actions">
      <span class="admin-note">This team's editable lineup page has not been created yet.</span>
      <a class="admin-secondary" href="${teamUrl(row.team_name)}">Team Page</a>
      <a class="admin-secondary" href="/rosters.html?league=${encodeURIComponent(row.league_code || "")}">League Rosters</a>
    </div>
  `;
}

async function boot() {
  const session = await requireSession();
  if (!session) return;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("public_team_owner_assignments")
    .select("team_name,league_code,role,active")
    .eq("user_id", session.user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  renderAssignment(data || {});
}

boot().catch((error) => {
  statusEl.textContent = `Could not load your team: ${error.message}`;
  cardEl.innerHTML = "";
});
