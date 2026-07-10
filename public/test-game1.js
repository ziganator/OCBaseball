import { game1Data } from "./game1-data.js?v=20260709l";

const API_ROOT = "https://statsapi.mlb.com/api/v1";
const SEASON = "2026";
const idCacheKey = "ownersclub.game1MlbIds";
const logCache = new Map();
const idCache = loadJson(idCacheKey, {});

const scoring = {
  hitters: {
    runs: 1,
    singles: 1,
    doubles: 3,
    triples: 4,
    homeRuns: 4,
    rbi: 1,
    stolenBases: 2,
    caughtStealing: -1,
    baseOnBalls: 1,
    hitByPitch: 1,
    groundIntoDoublePlay: -2
  },
  pitchers: {
    inningsPitchedPoints: 1,
    wins: 4,
    losses: -2,
    completeGames: 2,
    shutouts: 5,
    saves: 5,
    strikeOuts: 1,
    holds: 4,
    reliefAppearances: 1,
    noHitters: 5,
    perfectGames: 5,
    qualityStarts: 3,
    blownSaves: -1
  }
};

const dayToDate = {
  M: "2026-03-30",
  Tu: "2026-03-31",
  W: "2026-04-01",
  Th: "2026-04-02",
  F: "2026-04-03",
  St: "2026-04-04",
  Su: "2026-04-05"
};

const matchupSelect = document.querySelector("#game-matchup-select");
const statusEl = document.querySelector("#game-test-status");
const calculateButton = document.querySelector("#calculate-game-button");
const scoreboardGrid = document.querySelector("#game-scoreboard-grid");
const challengeTitle = document.querySelector("#card-challenge-title");
const challengeDescription = document.querySelector("#card-challenge-description");
const challengeList = document.querySelector("#card-challenge-list");
const matchupDetail = document.querySelector("#matchup-detail");

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveIdCache() {
  localStorage.setItem(idCacheKey, JSON.stringify(idCache));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value) {
  return Number(value || 0);
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function inningsToNumber(value) {
  if (!value) return 0;
  const [whole, outs] = String(value).split(".").map((part) => Number(part || 0));
  return whole + (outs || 0) / 3;
}

function normalizeStats(group, stat = {}, position = "") {
  if (group === "pitcher") {
    const ip = inningsToNumber(stat.inningsPitched);
    return {
      inningsPitchedPoints: ip,
      wins: number(stat.wins),
      losses: number(stat.losses),
      completeGames: number(stat.completeGames),
      shutouts: number(stat.shutouts),
      saves: number(stat.saves),
      strikeOuts: number(stat.strikeOuts),
      holds: number(stat.holds),
      reliefAppearances: position === "RP" && number(stat.gamesPlayed) ? 1 : 0,
      noHitters: number(stat.noHitters),
      perfectGames: number(stat.perfectGames),
      qualityStarts: ip >= 6 && number(stat.earnedRuns) <= 3 ? 1 : 0,
      blownSaves: number(stat.blownSaves)
    };
  }
  const hits = number(stat.hits);
  const doubles = number(stat.doubles);
  const triples = number(stat.triples);
  const homeRuns = number(stat.homeRuns);
  return {
    runs: number(stat.runs),
    singles: Math.max(0, hits - doubles - triples - homeRuns),
    doubles,
    triples,
    homeRuns,
    rbi: number(stat.rbi),
    stolenBases: number(stat.stolenBases),
    caughtStealing: number(stat.caughtStealing),
    baseOnBalls: number(stat.baseOnBalls),
    hitByPitch: number(stat.hitByPitch),
    groundIntoDoublePlay: number(stat.groundIntoDoublePlay)
  };
}

function scoreStats(group, stats) {
  const rules = group === "pitcher" ? scoring.pitchers : scoring.hitters;
  return Object.entries(rules).reduce((total, [key, points]) => total + number(stats[key]) * points, 0);
}

function addStats(total, stats) {
  for (const [key, value] of Object.entries(stats)) total[key] = number(total[key]) + number(value);
  return total;
}

async function resolvePlayerId(name) {
  if (idCache[name]) return idCache[name];
  const data = await fetchJson(`${API_ROOT}/people/search?names=${encodeURIComponent(name)}`);
  const lower = name.toLowerCase();
  const match = data.people?.find((person) => person.fullName?.toLowerCase() === lower)
    || data.people?.find((person) => person.active)
    || data.people?.[0];
  if (!match) return null;
  idCache[name] = match.id;
  saveIdCache();
  return match.id;
}

async function loadPlayerLogs(name, group) {
  const cacheKey = `${name}:${group}`;
  if (logCache.has(cacheKey)) return logCache.get(cacheKey);
  const playerId = await resolvePlayerId(name);
  if (!playerId) {
    logCache.set(cacheKey, []);
    return [];
  }
  const data = await fetchJson(`${API_ROOT}/people/${playerId}/stats?stats=gameLog&group=${group === "pitcher" ? "pitching" : "hitting"}&season=${SEASON}`);
  const logs = data.stats?.[0]?.splits || [];
  logCache.set(cacheKey, logs);
  return logs;
}

function datesForSegment(segment) {
  return new Set(segment.days.map((day) => dayToDate[day]).filter(Boolean));
}

async function scoreSegment(row, segment) {
  const logs = await loadPlayerLogs(segment.name, row.group);
  const dates = datesForSegment(segment);
  const selected = logs.filter((split) => dates.has(split.date));
  const stats = selected.reduce((total, split) => addStats(total, normalizeStats(row.group, split.stat, row.position)), {});
  let points = scoreStats(row.group, stats);
  if (row.position === "SP" && selected.length === 1) points *= 2;
  return { name: segment.name, days: segment.days, games: selected.length, points, stats };
}

async function scoreRosterRow(row) {
  const segments = [];
  for (const segment of row.substitutions) segments.push(await scoreSegment(row, segment));
  const points = segments.reduce((sum, segment) => sum + segment.points, 0);
  return { ...row, calculated: points, segments };
}

async function scoreTeam(team) {
  const rows = [];
  for (const row of team.players) {
    rows.push(await scoreRosterRow(row));
    statusEl.textContent = `Calculating ${team.team}: ${rows.length} of ${team.players.length} rows...`;
  }
  const calculated = rows.reduce((sum, row) => sum + row.calculated, 0);
  return { ...team, calculated, rows };
}

function renderScoreboard() {
  const games = game1Data.scoreboard.filter((game) => shortMatchup(game.away, game.home));
  scoreboardGrid.innerHTML = games.map((game) => {
    const awayWon = game.awayScore > game.homeScore;
    const homeWon = game.homeScore > game.awayScore;
    return `
      <button class="game-score-card" type="button" data-matchup="${escapeHtml(shortMatchup(game.away, game.home))}">
        <span class="${awayWon ? "is-winner" : ""}">${escapeHtml(game.away)} <strong>${game.awayScore}</strong></span>
        <em>at</em>
        <span class="${homeWon ? "is-winner" : ""}">${escapeHtml(game.home)} <strong>${game.homeScore}</strong></span>
      </button>
    `;
  }).join("");
}

function shortMatchup(away, home) {
  const matchup = game1Data.matchups.find((item) => item.away.team === away && item.home.team === home);
  return matchup?.id || "";
}

function renderChallenge() {
  challengeTitle.textContent = game1Data.cardChallenge.title;
  challengeDescription.textContent = game1Data.cardChallenge.description;
  challengeList.innerHTML = game1Data.cardChallenge.standings.slice(0, 8).map((row, index) => `
    <div class="challenge-row">
      <span>${index + 1}</span>
      <strong>${escapeHtml(row.team)}</strong>
      <em>${row.points}</em>
      <small>${escapeHtml(row.cards || "")}</small>
    </div>
  `).join("");
}

function renderMatchupShell(matchup) {
  matchupDetail.innerHTML = `
    <header class="game-matchup-header">
      <div>
        <span>Game ${game1Data.game} / Week ${game1Data.week}</span>
        <h2>${escapeHtml(matchup.away.team)} at ${escapeHtml(matchup.home.team)}</h2>
      </div>
      <div class="game-matchup-score">
        <strong>${matchup.away.summary.score}</strong>
        <span>Sheet</span>
        <strong>${matchup.home.summary.score}</strong>
      </div>
    </header>
    <div class="game-team-panels">
      ${teamPanel(matchup.away)}
      ${teamPanel(matchup.home)}
    </div>
  `;
}

function teamPanel(team, scoredTeam = null) {
  const rows = scoredTeam?.rows || team.players;
  const calculated = scoredTeam ? formatPoints(scoredTeam.calculated) : "Pending";
  const delta = scoredTeam ? formatPoints(scoredTeam.calculated - team.summary.score) : "";
  return `
    <section class="game-team-panel">
      <header>
        <h3>${escapeHtml(team.team)}</h3>
        <div>
          <span>Sheet ${team.summary.score}</span>
          <span>MLB ${calculated}</span>
          ${delta ? `<span>Diff ${delta}</span>` : ""}
        </div>
      </header>
      <div class="table-wrap lineup-table-wrap">
        <table class="game-roster-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>M</th>
              <th>Tu</th>
              <th>W</th>
              <th>Th</th>
              <th>F</th>
              <th>St</th>
              <th>Su</th>
              <th>Sheet</th>
              <th>MLB</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(rosterRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function rosterRow(row) {
  const calculated = Number.isFinite(row.calculated) ? formatPoints(row.calculated) : "";
  const diff = Number.isFinite(row.calculated) ? formatPoints(row.calculated - row.total) : "";
  return `
    <tr>
      <td>${escapeHtml(row.position)}</td>
      <td>
        <strong>${escapeHtml(row.name)}</strong>
        ${substitutionHtml(row)}
      </td>
      ${game1Data.days.map((day) => `<td>${row.daily[day] || ""}</td>`).join("")}
      <td>${row.total}</td>
      <td>${calculated}</td>
      <td class="${Number(diff) === 0 ? "" : "is-diff"}">${diff}</td>
    </tr>
  `;
}

function substitutionHtml(row) {
  if (!row.substitutions || row.substitutions.length <= 1) return "";
  return `<div class="substitution-track">${row.substitutions.map((segment) => `
    <span>${escapeHtml(segment.name)} <em>${segment.days.join("-")}</em></span>
  `).join("")}</div>`;
}

async function calculateSelected() {
  const matchup = game1Data.matchups.find((item) => item.id === matchupSelect.value) || game1Data.matchups[0];
  calculateButton.disabled = true;
  statusEl.textContent = "Loading MLB game logs...";
  try {
    const [away, home] = await Promise.all([scoreTeam(matchup.away), scoreTeam(matchup.home)]);
    matchupDetail.innerHTML = `
      <header class="game-matchup-header">
        <div>
          <span>Game ${game1Data.game} / Week ${game1Data.week}</span>
          <h2>${escapeHtml(matchup.away.team)} at ${escapeHtml(matchup.home.team)}</h2>
        </div>
        <div class="game-matchup-score">
          <strong>${formatPoints(away.calculated)}</strong>
          <span>MLB</span>
          <strong>${formatPoints(home.calculated)}</strong>
        </div>
      </header>
      <div class="game-team-panels">
        ${teamPanel(matchup.away, away)}
        ${teamPanel(matchup.home, home)}
      </div>
    `;
    statusEl.textContent = `Calculated ${matchup.away.team} and ${matchup.home.team}. SP one-start weeks are doubled.`;
  } catch (error) {
    statusEl.textContent = `Could not calculate MLB data: ${error.message}`;
  } finally {
    calculateButton.disabled = false;
  }
}

function init() {
  matchupSelect.innerHTML = game1Data.matchups.map((matchup) => `
    <option value="${escapeHtml(matchup.id)}">${escapeHtml(matchup.away.team)} at ${escapeHtml(matchup.home.team)}</option>
  `).join("");
  matchupSelect.value = "CLE-ARZ";
  renderScoreboard();
  renderChallenge();
  renderMatchupShell(game1Data.matchups.find((item) => item.id === matchupSelect.value) || game1Data.matchups[0]);
}

matchupSelect.addEventListener("change", () => {
  const matchup = game1Data.matchups.find((item) => item.id === matchupSelect.value);
  renderMatchupShell(matchup);
});

scoreboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-matchup]");
  if (!button?.dataset.matchup) return;
  matchupSelect.value = button.dataset.matchup;
  const matchup = game1Data.matchups.find((item) => item.id === matchupSelect.value);
  renderMatchupShell(matchup);
});

calculateButton.addEventListener("click", calculateSelected);

init();
