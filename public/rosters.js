import { getSupabaseClient } from "./auth.js";

const searchEl = document.querySelector("#rosters-search");
const leagueEl = document.querySelector("#rosters-league");
const teamEl = document.querySelector("#rosters-team");
const statusEl = document.querySelector("#rosters-status");
const gridEl = document.querySelector("#rosters-grid");

let rosterRows = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function teamSlug(teamName) {
  return String(teamName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function positionSort(value) {
  const position = String(value || "").toUpperCase();
  const order = { C: 10, "1B": 20, "2B": 30, "3B": 40, SS: 50, OF: 60, DH: 70, SP: 80, RP: 90 };
  return order[position] || 999;
}

function formatPositions(row) {
  const positions = Array.isArray(row.eligible_positions) && row.eligible_positions.length
    ? row.eligible_positions
    : [row.primary_position].filter(Boolean);
  return positions.join(", ");
}

function groupBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }
  return map;
}

function filteredRows() {
  const query = searchEl.value.trim().toLowerCase();
  const league = leagueEl.value;
  const team = teamEl.value;
  return rosterRows.filter((row) => {
    if (league !== "all" && row.league_code !== league) return false;
    if (team !== "all" && row.team_name !== team) return false;
    if (!query) return true;
    return [
      row.team_name,
      row.player_name,
      row.mlb_team_abbreviation,
      row.primary_position,
      formatPositions(row)
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderFilters() {
  const leagues = [...new Set(rosterRows.map((row) => row.league_code).filter(Boolean))].sort();
  const previousLeague = leagueEl.value;
  leagueEl.innerHTML = `<option value="all">All Leagues</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;
  if (leagues.includes(previousLeague)) leagueEl.value = previousLeague;

  const availableRows = leagueEl.value === "all"
    ? rosterRows
    : rosterRows.filter((row) => row.league_code === leagueEl.value);
  const teams = [...new Set(availableRows.map((row) => row.team_name).filter(Boolean))].sort();
  const previousTeam = teamEl.value;
  teamEl.innerHTML = `<option value="all">All Teams</option>${teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join("")}`;
  if (teams.includes(previousTeam)) teamEl.value = previousTeam;
}

function renderRosterCard(teamName, teamRows) {
  const first = teamRows[0] || {};
  const sortedRows = [...teamRows].sort((a, b) => {
    const positionDelta = positionSort(a.primary_position) - positionSort(b.primary_position);
    if (positionDelta) return positionDelta;
    return String(a.player_name || "").localeCompare(String(b.player_name || ""));
  });
  return `
    <article class="roster-card">
      <header class="roster-card-header">
        <div>
          <span>${escapeHtml(first.league_code || "")}</span>
          <a href="/teams/${teamSlug(teamName)}/">${escapeHtml(teamName)}</a>
        </div>
        <strong>${sortedRows.length}</strong>
      </header>
      <div class="table-wrap roster-table-wrap">
        <table class="roster-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>MLB</th>
              <th>Pos</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.player_name)}</td>
                <td>${escapeHtml(row.mlb_team_abbreviation || "")}</td>
                <td>${escapeHtml(formatPositions(row))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function render() {
  const rows = filteredRows();
  const teamGroups = [...groupBy(rows, (row) => row.team_name).entries()]
    .sort(([teamA], [teamB]) => teamA.localeCompare(teamB));

  if (!rosterRows.length) {
    gridEl.innerHTML = `<section class="lineup-card roster-empty">No roster import has been loaded yet.</section>`;
  } else if (!teamGroups.length) {
    gridEl.innerHTML = `<section class="lineup-card roster-empty">No roster rows match the current filters.</section>`;
  } else {
    gridEl.innerHTML = teamGroups.map(([teamName, teamRows]) => renderRosterCard(teamName, teamRows)).join("");
  }

  const teamCount = teamGroups.length;
  statusEl.textContent = rosterRows.length
    ? `Showing ${rows.length} players across ${teamCount} team${teamCount === 1 ? "" : "s"}.`
    : "Run the Season 32 roster import SQL in Supabase to populate this page.";
}

async function loadRosters() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("public_team_rosters")
      .select("season_number,league_code,team_id,team_name,player_id,player_name,primary_position,eligible_positions,mlb_team_abbreviation,acquired_on,acquisition_type")
      .eq("season_number", 32)
      .order("league_code", { ascending: true })
      .order("team_name", { ascending: true })
      .order("player_name", { ascending: true });

    if (error) throw error;
    rosterRows = data || [];
    renderFilters();
    render();
  } catch (error) {
    statusEl.textContent = `Could not load rosters: ${error.message}`;
    gridEl.innerHTML = "";
  }
}

searchEl.addEventListener("input", render);
leagueEl.addEventListener("change", () => {
  renderFilters();
  render();
});
teamEl.addEventListener("change", render);

loadRosters();
