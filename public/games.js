import {
  displayTeam,
  teams as seedTeams
} from "./team-data.js?v=20260714b";

const SEASON = 32;
const WEEK_COUNT = 18;
const WEEK_ONE_START = "2026-03-30T00:00:00";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
let DAYS = makeWeekDays(1);

const weekSelect = document.querySelector("#games-week-select");
const statusEl = document.querySelector("#games-status");
const bestOfWeekEl = document.querySelector("#best-of-week");
const scoreboardEl = document.querySelector("#games-scoreboard");
const detailEl = document.querySelector("#games-detail");
const teamAliases = new Map([
  ["SAN ANTONIO OCOTILLOS", "SAN ANTONIO OCATILLOS"]
]);
const teams = seedTeams.map(displayTeam);
const teamsByName = new Map(teams.map((team) => [normalizeTeam(team.name), team]));
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

function normalizeTeam(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return teamAliases.get(normalized) || normalized;
}

function teamMeta(teamName) {
  return teamsByName.get(normalizeTeam(teamName)) || null;
}

function teamImage(teamName, type = "logo") {
  const team = teamMeta(teamName);
  if (!team) return "";
  return type === "cap"
    ? team.capImage || team.listBanner || team.logo || ""
    : team.logo || team.listBanner || team.capImage || "";
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
  bestOfWeekEl.innerHTML = "";
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
    renderBestOfWeek();
    renderScoreboard();
  } catch (error) {
    statusEl.textContent = `Could not load games: ${error.message}`;
  }
}

function renderBestOfWeek() {
  const best = bestOfWeek(currentData);
  if (!best.length) {
    bestOfWeekEl.innerHTML = "";
    return;
  }

  bestOfWeekEl.innerHTML = `
    <section class="best-week-card">
      <header class="best-week-header">
        ${bestTeamPanel(best.find((league) => league.key === "keystone"))}
        <div class="best-week-title">
          <span>Game</span>
          <strong>${formatPoints(currentData.game || currentData.week || weekSelect.value)}</strong>
          <em>Teams of the Week</em>
        </div>
        ${bestTeamPanel(best.find((league) => league.key === "diamond"))}
      </header>
      <div class="best-week-rule"></div>
      <div class="best-week-player-title">Players of the Week</div>
      <div class="best-week-players">
        ${bestPlayerRows(best).join("")}
      </div>
    </section>
  `;
}

function bestOfWeek(data) {
  const matchups = data?.matchups || [];
  const players = data?.players || [];
  const leagueByMatchup = new Map(matchups.map((matchup) => [matchup.matchup_key, matchup.league_code]));
  const teamMetrics = weeklyTeamMetrics(data);

  return ["keystone", "diamond"].map((league) => ({
    key: league,
    topTeam: topTeamOfWeek(matchups, teamMetrics, league),
    topHitter: topPlayersOfWeek(players, teamMetrics, leagueByMatchup, league, (row) => !["SP", "RP"].includes(String(row.roster_slot || "").toUpperCase())),
    topStarter: topPlayersOfWeek(players, teamMetrics, leagueByMatchup, league, (row) => String(row.roster_slot || "").toUpperCase() === "SP"),
    topReliever: topPlayersOfWeek(players, teamMetrics, leagueByMatchup, league, (row) => String(row.roster_slot || "").toUpperCase() === "RP")
  })).filter((league) => league.topTeam || league.topHitter.length || league.topStarter.length || league.topReliever.length);
}

function weeklyTeamMetrics(data) {
  const metrics = new Map();
  for (const matchup of data?.matchups || []) {
    const awayScore = Number(matchup.away_score || 0);
    const homeScore = Number(matchup.home_score || 0);
    metrics.set(teamMetricKey(matchup.matchup_key, matchup.away_team_name), {
      matchup: matchup.matchup_key,
      team: matchup.away_team_name,
      total: awayScore,
      pitching: 0,
      won: awayScore > homeScore
    });
    metrics.set(teamMetricKey(matchup.matchup_key, matchup.home_team_name), {
      matchup: matchup.matchup_key,
      team: matchup.home_team_name,
      total: homeScore,
      pitching: 0,
      won: homeScore > awayScore
    });
  }

  for (const row of data?.teams || []) {
    const key = teamMetricKey(row.matchup_key, row.team_name);
    const metric = metrics.get(key) || {
      matchup: row.matchup_key,
      team: row.team_name,
      total: 0,
      pitching: 0,
      won: false
    };
    metric.pitching += Number(row.pitching_points || 0);
    metrics.set(key, metric);
  }

  return metrics;
}

function teamMetricKey(matchup, team) {
  return `${matchup}|${normalizeTeam(team)}`;
}

function topTeamOfWeek(matchups, teamMetrics, league) {
  const entries = [];
  for (const matchup of matchups.filter((game) => game.league_code === league)) {
    const awayMetric = teamMetrics.get(teamMetricKey(matchup.matchup_key, matchup.away_team_name));
    const homeMetric = teamMetrics.get(teamMetricKey(matchup.matchup_key, matchup.home_team_name));
    entries.push({ team: matchup.away_team_name, points: Number(matchup.away_score || 0), pitching: awayMetric?.pitching || 0 });
    entries.push({ team: matchup.home_team_name, points: Number(matchup.home_score || 0), pitching: homeMetric?.pitching || 0 });
  }
  return entries.sort((a, b) => b.points - a.points || b.pitching - a.pitching || a.team.localeCompare(b.team))[0] || null;
}

function topPlayersOfWeek(players, teamMetrics, leagueByMatchup, league, predicate) {
  const totals = new Map();
  for (const row of players) {
    if (leagueByMatchup.get(row.matchup_key) !== league || !predicate(row)) continue;
    const name = row.player_name || row.raw_stats?.rowPlayer || "";
    if (!name) continue;
    const team = row.team_name || "";
    const slot = row.roster_slot || "";
    const key = `${name}|${team}|${slot}`;
    const metric = teamMetrics.get(teamMetricKey(row.matchup_key, team));
    const current = totals.get(key) || {
      name,
      team,
      slot,
      points: 0,
      teamTotal: metric?.total || 0,
      teamPitching: metric?.pitching || 0,
      teamWon: Boolean(metric?.won)
    };
    current.points += Number(row.calculated_points || 0);
    totals.set(key, current);
  }
  const sorted = Array.from(totals.values())
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const topScore = sorted[0]?.points;
  if (!Number.isFinite(topScore)) return [];
  return resolvePlayerAwardTies(sorted.filter((entry) => entry.points === topScore));
}

function resolvePlayerAwardTies(entries) {
  let tied = entries;
  const winningTeamEntries = tied.filter((entry) => entry.teamWon);
  if (winningTeamEntries.length) tied = winningTeamEntries;

  const topPitching = Math.max(...tied.map((entry) => Number(entry.teamPitching || 0)));
  tied = tied.filter((entry) => Number(entry.teamPitching || 0) === topPitching);

  const topTotal = Math.max(...tied.map((entry) => Number(entry.teamTotal || 0)));
  tied = tied.filter((entry) => Number(entry.teamTotal || 0) === topTotal);

  return tied.sort((a, b) => a.name.localeCompare(b.name));
}

function bestTeamPanel(league) {
  if (!league?.topTeam) return `<div class="best-team is-empty"></div>`;
  const image = teamImage(league.topTeam.team, "logo");
  return `
    <div class="best-team is-${escapeHtml(league.key)}">
      ${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}
      <strong>${escapeHtml(league.topTeam.team)}</strong>
      <span>${formatPoints(league.topTeam.points)} Points</span>
    </div>
  `;
}

function bestPlayerRows(best) {
  const keystone = best.find((league) => league.key === "keystone") || {};
  const diamond = best.find((league) => league.key === "diamond") || {};
  return [
    { label: "Top Player", keystone: keystone.topHitter || [], diamond: diamond.topHitter || [] },
    { label: "Top Starting Pitcher", keystone: keystone.topStarter || [], diamond: diamond.topStarter || [] },
    { label: "Top Reliever", keystone: keystone.topReliever || [], diamond: diamond.topReliever || [] }
  ].map(bestPlayerAwardRow);
}

function bestPlayerAwardRow(row) {
  const entries = [
    ...row.keystone.map((entry) => ({ league: "keystone", entry })),
    ...row.diamond.map((entry) => ({ league: "diamond", entry }))
  ];
  const visibleEntries = collapseMatchingEntries(entries);

  return `
    <div class="best-player-row">
      <div class="best-player-marks">
        ${bestPlayerMark("keystone", row.keystone[0])}
        ${bestPlayerMark("diamond", row.diamond[0])}
      </div>
      <p>
        <span>${escapeHtml(row.label)}</span>
        ${visibleEntries.map(bestPlayerText).join("")}
      </p>
    </div>
  `;
}

function collapseMatchingEntries(entries) {
  const actual = entries.filter(({ entry }) => entry);
  const collapsed = [];
  for (const item of actual) {
    const existing = collapsed.find((entry) => samePlayerAward(entry.entry, item.entry));
    if (existing) {
      existing.league = "both";
    } else {
      collapsed.push({ ...item });
    }
  }
  return collapsed;
}

function samePlayerAward(a, b) {
  return String(a?.name || "").toLowerCase() === String(b?.name || "").toLowerCase();
}

function bestPlayerMark(league, entry) {
  const firstEntry = Array.isArray(entry) ? entry[0] : entry;
  const cap = firstEntry ? teamImage(firstEntry.team, "cap") : "";
  return `
    <div class="best-player-team-mark is-${escapeHtml(league)}">
      ${cap ? `<img src="${escapeHtml(cap)}" alt="">` : ""}
    </div>
  `;
}

function bestPlayerText({ league, entry }) {
  if (!entry) return "";
  const leagueLabel = league === "both" ? "" : `<em>${escapeHtml(league)}</em>`;
  return `
    <strong>
      ${leagueLabel}
      ${escapeHtml(entry.name)}: ${formatPoints(entry.points)} Points
    </strong>
  `;
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
    <div class="game-team-panels">
      ${teamPanel(away, "Away")}
      ${matchupSummary(matchup, away, home)}
      ${teamPanel(home, "Home")}
    </div>
  `;
}

function scrollToMatchupDetail() {
  requestAnimationFrame(() => {
    detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
  scrollToMatchupDetail();
});

scoreboardEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-matchup]");
  if (!row?.dataset.matchup) return;
  event.preventDefault();
  selectedMatchup = row.dataset.matchup;
  renderScoreboard();
  renderSelectedMatchup();
  scrollToMatchupDetail();
});

fillWeeks();
weekSelect.addEventListener("change", () => {
  const params = new URLSearchParams(location.search);
  params.set("week", weekSelect.value);
  history.replaceState(null, "", `${location.pathname}?${params}`);
  loadWeek();
});
loadWeek();
