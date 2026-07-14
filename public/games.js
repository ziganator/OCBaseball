const SEASON = 32;
const WEEK_COUNT = 18;
const WEEK_ONE_START = "2026-03-30T00:00:00";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
let DAYS = makeWeekDays(1);

const weekSelect = document.querySelector("#games-week-select");
const statusEl = document.querySelector("#games-status");
const scoreboardEl = document.querySelector("#games-scoreboard");
const detailEl = document.querySelector("#games-detail");
let currentData = null;
let selectedMatchup = "";

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

function makeWeekDays(week) {
  const keys = ["M", "Tu", "W", "Th", "F", "St", "Su"];
  const start = new Date(WEEK_ONE_START);
  start.setDate(start.getDate() + ((Number(week) || 1) - 1) * 7);

  return keys.map((key, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { key, date: day.toISOString().slice(0, 10) };
  });
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
  DAYS = makeWeekDays(week);
  statusEl.textContent = "";
  scoreboardEl.innerHTML = "";
  detailEl.innerHTML = "";
  selectedMatchup = "";

  try {
    const response = await fetch(`/api/game-results?season=${SEASON}&week=${week}&game=${week}`);
    if (!response.ok) throw new Error(`Game results returned ${response.status}`);
    const payload = await response.json();
    currentData = payload.data || {};
    const matchups = currentData.matchups || [];

    if (!matchups.length) {
      statusEl.textContent = "";
      return;
    }

    statusEl.textContent = "";
    renderScoreboard();
  } catch (error) {
    statusEl.textContent = `Could not load games: ${error.message}`;
  }
}

function renderScoreboard() {
  const matchups = currentData?.matchups || [];
  const grouped = {
    keystone: matchups.filter((game) => game.league_code === "keystone"),
    diamond: matchups.filter((game) => game.league_code === "diamond")
  };

  scoreboardEl.innerHTML = `
    <div class="game-scoreboard-grid">
      ${Object.entries(grouped)
        .filter(([, games]) => games.length)
        .map(([league, games]) => scoreboardTable(league, games))
        .join("")}
    </div>
  `;
}

function scoreboardTable(league, games) {
  return `
    <section class="game-scoreboard-league">
      <h3>${escapeHtml(league)}</h3>
      <table class="game-scoreboard-table is-${escapeHtml(league)}">
        <thead>
          <tr>
            <th>PSR</th>
            <th>Score</th>
            <th>Away</th>
            <th>Lead</th>
            <th>At</th>
            <th>Lead</th>
            <th>Home</th>
            <th>Score</th>
            <th>PSR</th>
          </tr>
        </thead>
        <tbody>${games.map(scoreboardRow).join("")}</tbody>
      </table>
    </section>
  `;
}

function scoreboardRow(game) {
  const awayWon = Number(game.away_score) > Number(game.home_score);
  const homeWon = Number(game.home_score) > Number(game.away_score);
  return `
    <tr class="is-${escapeHtml(game.league_code)} ${selectedMatchup === game.matchup_key ? "is-selected" : ""}" data-matchup="${escapeHtml(game.matchup_key)}" tabindex="0">
      <td>${formatPoints(game.away_psr)}</td>
      <td class="${awayWon ? "is-winner" : ""}">${formatPoints(game.away_score)}</td>
      <th>${escapeHtml(game.away_team_name)}</th>
      <td>${Number(game.away_lead) ? formatPoints(game.away_lead) : ""}</td>
      <td>@</td>
      <td>${Number(game.home_lead) ? formatPoints(game.home_lead) : ""}</td>
      <th>${escapeHtml(game.home_team_name)}</th>
      <td class="${homeWon ? "is-winner" : ""}">${formatPoints(game.home_score)}</td>
      <td>${formatPoints(game.home_psr)}</td>
    </tr>
  `;
}

function renderSelectedMatchup() {
  const matchup = (currentData?.matchups || []).find((game) => game.matchup_key === selectedMatchup);
  if (!matchup) {
    detailEl.innerHTML = "";
    return;
  }
  const away = buildTeam(matchup, matchup.away_team_name, "A");
  const home = buildTeam(matchup, matchup.home_team_name, "H");
  detailEl.className = "game-matchup-detail";
  detailEl.innerHTML = `
    <header class="game-matchup-header">
      <div>
        <span>Game ${currentData.game} / Week ${currentData.week}</span>
        <h2>${escapeHtml(matchup.away_team_name)} at ${escapeHtml(matchup.home_team_name)}</h2>
      </div>
      <div class="game-matchup-score">
        <strong>${formatPoints(matchup.away_score)}</strong>
        <span>Stored</span>
        <strong>${formatPoints(matchup.home_score)}</strong>
      </div>
    </header>
    ${spreadsheetMatchupSummary(matchup)}
    ${matchupSummary(matchup, away, home)}
    <div class="game-team-panels">
      ${teamPanel(away, "Away")}
      ${teamPanel(home, "Home")}
    </div>
  `;
}

function spreadsheetMatchupSummary(matchup) {
  return `
    <section class="game-spreadsheet-score is-${escapeHtml(matchup.league_code)}" aria-label="Stored matchup score">
      <table>
        <thead>
          <tr><th>PSR</th><th>Score</th><th>Away</th><th>Lead</th><th>AT</th><th>Lead</th><th>Home</th><th>Score</th><th>PSR</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${formatPoints(matchup.away_psr)}</td>
            <td>${formatPoints(matchup.away_score)}</td>
            <th>${escapeHtml(matchup.away_team_name)}</th>
            <td>${Number(matchup.away_lead) ? formatPoints(matchup.away_lead) : ""}</td>
            <td>@</td>
            <td>${Number(matchup.home_lead) ? formatPoints(matchup.home_lead) : ""}</td>
            <th>${escapeHtml(matchup.home_team_name)}</th>
            <td>${formatPoints(matchup.home_score)}</td>
            <td>${formatPoints(matchup.home_psr)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function buildTeam(matchup, teamName, homeAway) {
  const teamRows = (currentData.teams || [])
    .filter((row) => row.matchup_key === matchup.matchup_key && row.team_name === teamName)
    .sort((a, b) => a.stat_date.localeCompare(b.stat_date));
  const playerRows = (currentData.players || [])
    .filter((row) => row.matchup_key === matchup.matchup_key && row.team_name === teamName)
    .sort((a, b) => slotSort(a.roster_slot) - slotSort(b.roster_slot) || String(a.raw_stats?.rowPlayer || a.player_name).localeCompare(String(b.raw_stats?.rowPlayer || b.player_name)) || a.stat_date.localeCompare(b.stat_date));

  return {
    team: teamName,
    homeAway,
    daily: Object.fromEntries(DAYS.map((day) => [day.key, Number(teamRows.find((row) => row.stat_date === day.date)?.calculated_points || 0)])),
    summary: {
      score: teamRows.reduce((sum, row) => sum + Number(row.calculated_points || 0), 0),
      offense: teamRows.reduce((sum, row) => sum + Number(row.offense_points || 0), 0),
      pitching: teamRows.reduce((sum, row) => sum + Number(row.pitching_points || 0), 0),
      lead: homeAway === "A" ? matchup.away_lead : matchup.home_lead
    },
    players: buildRosterRows(playerRows)
  };
}

function slotSort(slot = "") {
  const order = ["C", "1B", "2B", "3B", "SS", "OF", "DH", "SP", "RP"];
  const index = order.indexOf(slot);
  return index >= 0 ? index : 99;
}

function buildRosterRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const rowPlayer = row.raw_stats?.rowPlayer || row.player_name;
    const key = `${row.roster_slot}|${rowPlayer}`;
    if (!groups.has(key)) {
      groups.set(key, {
        position: row.roster_slot || "",
        name: rowPlayer,
        daily: {},
        total: 0,
        segmentDays: new Map()
      });
    }
    const group = groups.get(key);
    const day = dayKey(row.stat_date);
    group.daily[day] = Number(group.daily[day] || 0) + Number(row.calculated_points || 0);
    group.total += Number(row.calculated_points || 0);
    if (!group.segmentDays.has(row.player_name)) group.segmentDays.set(row.player_name, []);
    group.segmentDays.get(row.player_name).push(day);
  }

  return Array.from(groups.values()).map((row) => {
    row.substitutions = Array.from(row.segmentDays.entries()).map(([name, days]) => ({ name, days: sortDays([...new Set(days)]) }));
    delete row.segmentDays;
    return row;
  });
}

function dayKey(date) {
  return DAYS.find((day) => day.date === date)?.key || "";
}

function sortDays(days) {
  return days.sort((a, b) => DAYS.findIndex((day) => day.key === a) - DAYS.findIndex((day) => day.key === b));
}

function matchupSummary(matchup, away, home) {
  return `
    <section class="game-summary-sheet" aria-label="Team summary">
      <table>
        <thead>
          <tr>
            <th>Team</th>
            ${DAYS.map((day) => `<th>${day.key}</th>`).join("")}
            <th>Points</th>
            <th>Offense</th>
            <th>Pitching</th>
            <th>Lead</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRow(away, "Away")}
          ${summaryRow(home, "Home")}
        </tbody>
      </table>
    </section>
  `;
}

function summaryRow(team, side) {
  return `
    <tr class="${side === "Home" ? "is-home" : "is-away"}">
      <th><span>${escapeHtml(side)}</span>${escapeHtml(team.team)}</th>
      ${DAYS.map((day) => `<td>${formatPoints(team.daily[day.key] || 0)}</td>`).join("")}
      <td>${formatPoints(team.summary.score)}</td>
      <td>${formatPoints(team.summary.offense)}</td>
      <td>${formatPoints(team.summary.pitching)}</td>
      <td>${Number(team.summary.lead) ? formatPoints(team.summary.lead) : ""}</td>
    </tr>
  `;
}

function teamPanel(team, side = "") {
  return `
    <section class="game-team-panel">
      <header>
        <h3><span>${escapeHtml(side)}</span>${escapeHtml(team.team)}</h3>
        <div><span>Stored ${formatPoints(team.summary.score)}</span></div>
      </header>
      <div class="table-wrap lineup-table-wrap">
        <table class="game-roster-table">
          <thead>
            <tr><th>Pos</th><th>Player</th>${DAYS.map((day) => `<th>${day.key}</th>`).join("")}<th>Total</th></tr>
          </thead>
          <tbody>${team.players.map(rosterRow).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function rosterRow(row) {
  return `
    <tr>
      <td>${escapeHtml(row.position)}</td>
      <td>${playerNameHtml(row)}</td>
      ${DAYS.map((day) => `<td class="${substitutionClassForDay(row, day.key)}">${formatPoints(row.daily[day.key] || 0)}</td>`).join("")}
      <td>${formatPoints(row.total)}</td>
    </tr>
  `;
}

function playerNameHtml(row) {
  if (!row.substitutions || row.substitutions.length <= 1) return `<strong>${escapeHtml(row.name)}</strong>`;
  return `
    <div class="game-player-sub-tags">
      ${row.substitutions.map((segment, index) => `
        <span class="${substitutionColorClass(index)}">
          ${escapeHtml(segment.name)}
          <em>${escapeHtml(formatDays(segment.days))}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function formatDays(days) {
  if (!days?.length) return "";
  if (days.length === 1) return days[0];
  return `${days[0]}-${days[days.length - 1]}`;
}

function substitutionClassForDay(row, day) {
  if (!row.substitutions || row.substitutions.length <= 1) return "";
  const index = row.substitutions.findIndex((segment) => segment.days.includes(day));
  return index > 0 ? `game-sub-day ${substitutionColorClass(index)}` : "";
}

function substitutionColorClass(index) {
  return index > 0 ? `game-sub-color-${(index - 1) % 6}` : "game-sub-primary";
}

scoreboardEl.addEventListener("click", (event) => {
  const row = event.target.closest("[data-matchup]");
  if (!row?.dataset.matchup) return;
  selectedMatchup = row.dataset.matchup;
  renderScoreboard();
  renderSelectedMatchup();
});

scoreboardEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-matchup]");
  if (!row?.dataset.matchup) return;
  event.preventDefault();
  selectedMatchup = row.dataset.matchup;
  renderScoreboard();
  renderSelectedMatchup();
});

fillWeeks();
weekSelect.addEventListener("change", () => {
  const params = new URLSearchParams(location.search);
  params.set("week", weekSelect.value);
  history.replaceState(null, "", `${location.pathname}?${params}`);
  loadWeek();
});
loadWeek();
