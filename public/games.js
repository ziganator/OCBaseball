const SEASON = 32;
const WEEK_COUNT = 18;
const WEEK_ONE_START = "2026-03-30T00:00:00";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const weekSelect = document.querySelector("#games-week-select");
const statusEl = document.querySelector("#games-status");
const scoreboardEl = document.querySelector("#games-scoreboard");
const detailEl = document.querySelector("#games-detail");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPoints(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function currentWeek() {
  const start = new Date(WEEK_ONE_START);
  const now = new Date();
  const week = Math.floor((now - start) / MS_PER_WEEK) + 1;
  return Math.min(WEEK_COUNT, Math.max(1, week));
}

function fillWeeks() {
  weekSelect.innerHTML = Array.from({ length: WEEK_COUNT }, (_, index) => {
    const week = index + 1;
    return `<option value="${week}">Season ${SEASON} - Week ${week}</option>`;
  }).join("");

  const requested = Number(new URLSearchParams(location.search).get("week"));
  weekSelect.value = String(requested >= 1 && requested <= WEEK_COUNT ? requested : currentWeek());
}

async function loadWeek() {
  const week = Number(weekSelect.value);
  statusEl.textContent = `Loading Season ${SEASON}, Week ${week}...`;
  scoreboardEl.innerHTML = "";
  detailEl.innerHTML = "";

  try {
    const response = await fetch(`/api/game-results?season=${SEASON}&week=${week}&game=${week}`);
    if (!response.ok) throw new Error(`Game results returned ${response.status}`);
    const payload = await response.json();
    const data = payload.data || {};
    const matchups = data.matchups || [];

    if (!matchups.length) {
      statusEl.textContent = `Season ${SEASON}, Week ${week}`;
      return;
    }

    statusEl.textContent = `Loaded ${matchups.length} games for Season ${SEASON}, Week ${week}.`;
    scoreboardEl.innerHTML = scoreboardHtml(matchups);
    detailEl.innerHTML = detailsHtml(data);
  } catch (error) {
    statusEl.textContent = `Could not load games: ${error.message}`;
  }
}

function scoreboardHtml(matchups) {
  const grouped = {
    keystone: matchups.filter((game) => game.league_code === "keystone"),
    diamond: matchups.filter((game) => game.league_code === "diamond"),
    other: matchups.filter((game) => game.league_code !== "keystone" && game.league_code !== "diamond")
  };

  return Object.entries(grouped)
    .filter(([, games]) => games.length)
    .map(([league, games]) => `
      <section class="games-league">
        <h2>${escapeHtml(league)}</h2>
        <table class="game-scoreboard-table is-${escapeHtml(league)}">
          <thead>
            <tr>
              <th>PSR</th><th>Score</th><th>Away</th><th>Lead</th><th>At</th><th>Lead</th><th>Home</th><th>Score</th><th>PSR</th>
            </tr>
          </thead>
          <tbody>
            ${games.map((game) => scoreboardRow(game)).join("")}
          </tbody>
        </table>
      </section>
    `).join("");
}

function scoreboardRow(game) {
  const awayWon = Number(game.away_score) > Number(game.home_score);
  const homeWon = Number(game.home_score) > Number(game.away_score);
  return `
    <tr>
      <td>${formatPoints(game.away_psr)}</td>
      <td class="${awayWon ? "is-winner" : ""}">${formatPoints(game.away_score)}</td>
      <th>${escapeHtml(game.away_team_name)}</th>
      <td>${formatPoints(game.away_lead)}</td>
      <td>@</td>
      <td>${formatPoints(game.home_lead)}</td>
      <th>${escapeHtml(game.home_team_name)}</th>
      <td class="${homeWon ? "is-winner" : ""}">${formatPoints(game.home_score)}</td>
      <td>${formatPoints(game.home_psr)}</td>
    </tr>
  `;
}

function detailsHtml(data) {
  const teamRows = data.teams || [];
  const playerRows = data.players || [];
  return (data.matchups || []).map((matchup) => {
    const away = teamRows.filter((team) => team.matchup_key === matchup.matchup_key && team.team_name === matchup.away_team_name);
    const home = teamRows.filter((team) => team.matchup_key === matchup.matchup_key && team.team_name === matchup.home_team_name);
    return `
      <article class="games-card">
        <header>
          <h2>${escapeHtml(matchup.away_team_name)} at ${escapeHtml(matchup.home_team_name)}</h2>
        </header>
        ${teamDailyHtml(matchup.away_team_name, away)}
        ${playerTableHtml(matchup.away_team_name, playerRowsFor(playerRows, matchup, matchup.away_team_name))}
        ${teamDailyHtml(matchup.home_team_name, home)}
        ${playerTableHtml(matchup.home_team_name, playerRowsFor(playerRows, matchup, matchup.home_team_name))}
      </article>
    `;
  }).join("");
}

function teamDailyHtml(teamName, rows) {
  const dailyCells = Array.from({ length: 7 }, (_, index) => rows[index]?.calculated_points ?? "");
  const total = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.calculated_points || 0), 0)
    : "";
  return `
    <section class="games-team-summary">
      <h3>${escapeHtml(teamName)}</h3>
      <table>
        <thead><tr><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th><th>Total</th></tr></thead>
        <tbody>
          <tr>
            ${dailyCells.map((points) => `<td>${formatPoints(points)}</td>`).join("")}
            <td>${formatPoints(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function playerRowsFor(rows, matchup, teamName) {
  return rows.filter((row) => row.matchup_key === matchup.matchup_key && row.team_name === teamName);
}

function playerTableHtml(teamName, rows) {
  if (!rows.length) return "";
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.roster_slot || ""}|${row.player_name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return `
    <table class="games-player-table" aria-label="${escapeHtml(teamName)} players">
      <thead><tr><th>Pos</th><th>Player</th><th>Date</th><th>Pts</th></tr></thead>
      <tbody>
        ${Array.from(grouped.values()).map((group) => group
          .map((row) => `
            <tr>
              <td>${escapeHtml(row.roster_slot || "")}</td>
              <td>${escapeHtml(row.player_name)}</td>
              <td>${escapeHtml(row.stat_date)}</td>
              <td>${formatPoints(row.calculated_points)}</td>
            </tr>
          `).join("")
        ).join("")}
      </tbody>
    </table>
  `;
}

fillWeeks();
weekSelect.addEventListener("change", () => {
  const params = new URLSearchParams(location.search);
  params.set("week", weekSelect.value);
  history.replaceState(null, "", `${location.pathname}?${params}`);
  loadWeek();
});
loadWeek();
