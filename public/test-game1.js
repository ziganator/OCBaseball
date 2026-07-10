import { game1Data } from "./game1-data.js?v=20260710f";
import { teams } from "./team-data.js?v=20260710f";

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
const detailDialog = document.querySelector("#game-detail-dialog");
const detailTitle = document.querySelector("#game-detail-title");
const detailBody = document.querySelector("#game-detail-body");
const detailClose = document.querySelector("#game-detail-close");
const detailStore = new Map();
let detailCounter = 0;

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

function truncatePoints(value) {
  return Math.trunc(number(value));
}

function creditedPoints(value) {
  return Math.max(0, truncatePoints(value));
}

function displayedSheetPoints(value) {
  return Math.max(0, number(value));
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

function scoringBreakdown(group, stats) {
  const rules = group === "pitcher" ? scoring.pitchers : scoring.hitters;
  return Object.entries(rules)
    .map(([key, points]) => {
      const count = number(stats[key]);
      return { key, label: scoringLabel(key), count, points, total: count * points };
    })
    .filter((item) => item.count);
}

function scoringLabel(key) {
  return {
    runs: "Runs (R)",
    singles: "Singles (1B)",
    doubles: "Doubles (2B)",
    triples: "Triples (3B)",
    homeRuns: "Home Runs (HR)",
    rbi: "Runs Batted In (RBI)",
    stolenBases: "Stolen Bases (SB)",
    caughtStealing: "Caught Stealing (CS)",
    baseOnBalls: "Walks (BB)",
    hitByPitch: "Hit By Pitch (HBP)",
    groundIntoDoublePlay: "Ground Into Double Play (GIDP)",
    inningsPitchedPoints: "Innings Pitched (IP)",
    wins: "Wins (W)",
    losses: "Losses (L)",
    completeGames: "Complete Games (CG)",
    shutouts: "Shutouts (SHO)",
    saves: "Saves (SV)",
    strikeOuts: "Strikeouts (K)",
    holds: "Holds (HLD)",
    reliefAppearances: "Relief Appearances (RAPP)",
    noHitters: "No Hitters (NH)",
    perfectGames: "Perfect Games (PG)",
    qualityStarts: "Quality Starts (QS)",
    blownSaves: "Blown Saves (BSV)"
  }[key] || key;
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
  const daily = {};
  const details = {};
  for (const split of selected) {
    const day = Object.entries(dayToDate).find(([, date]) => date === split.date)?.[0];
    if (!day) continue;
    const normalized = normalizeStats(row.group, split.stat, row.position);
    const rawPoints = scoreStats(row.group, normalized);
    daily[day] = number(daily[day]) + creditedPoints(rawPoints);
    details[day] ||= [];
    details[day].push({
      player: segment.name,
      date: split.date,
      opponent: split.opponent?.name || "",
      summary: split.stat?.summary || "",
      rawPoints,
      points: creditedPoints(rawPoints),
      floored: truncatePoints(rawPoints) < 0,
      items: scoringBreakdown(row.group, normalized)
    });
  }
  if (row.position === "SP" && selected.length === 1) {
    const day = Object.keys(daily)[0];
    if (day) {
      daily[day] *= 2;
      details[day] = (details[day] || []).map((detail) => ({
        ...detail,
        doubled: true,
        points: creditedPoints(detail.rawPoints * 2),
        floored: truncatePoints(detail.rawPoints * 2) < 0
      }));
    }
  }
  for (const day of Object.keys(daily)) daily[day] = creditedPoints(daily[day]);
  for (const day of Object.keys(details)) {
    details[day] = details[day].map((detail) => ({ ...detail, points: creditedPoints(detail.points) }));
  }
  const points = Object.values(daily).reduce((sum, value) => sum + number(value), 0);
  return { name: segment.name, days: segment.days, games: selected.length, points, stats, daily, details };
}

async function scoreRosterRow(row) {
  const segments = [];
  for (const segment of row.substitutions) segments.push(await scoreSegment(row, segment));
  const points = segments.reduce((sum, segment) => sum + segment.points, 0);
  const calculatedDaily = segments.reduce((totals, segment) => addStats(totals, segment.daily), {});
  const details = {};
  for (const segment of segments) {
    for (const [day, entries] of Object.entries(segment.details)) {
      details[day] ||= [];
      details[day].push(...entries);
    }
  }
  return { ...row, calculated: points, calculatedDaily, details, segments };
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
  resetDetails();
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
    ${spreadsheetMatchupSummary(matchup)}
    ${matchupSummary(matchup.away, matchup.home)}
    <div class="game-team-panels">
      ${teamPanel(matchup.away, null, "Away")}
      ${teamPanel(matchup.home, null, "Home")}
    </div>
  `;
}

function spreadsheetMatchupSummary(matchup) {
  const scoreboard = game1Data.scoreboard.find((game) => game.away === matchup.away.team && game.home === matchup.home.team) || {};
  const league = teamLeague(matchup.away.team);
  return `
    <section class="game-spreadsheet-score is-${league}" aria-label="Spreadsheet matchup score">
      <table>
        <thead>
          <tr>
            <th>PSR</th>
            <th>Score</th>
            <th>Away</th>
            <th>Lead</th>
            <th>AT</th>
            <th>Lead</th>
            <th>Home</th>
            <th>Score</th>
            <th>PSR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${scoreboard.awayPsr || ""}</td>
            <td>${formatPoints(displayedSheetPoints(scoreboard.awayScore))}</td>
            <th>${escapeHtml(matchup.away.team)}</th>
            <td>${scoreboard.awayLead ? formatPoints(displayedSheetPoints(scoreboard.awayLead)) : ""}</td>
            <td>@</td>
            <td>${scoreboard.homeLead ? formatPoints(displayedSheetPoints(scoreboard.homeLead)) : ""}</td>
            <th>${escapeHtml(matchup.home.team)}</th>
            <td>${formatPoints(displayedSheetPoints(scoreboard.homeScore))}</td>
            <td>${scoreboard.homePsr || ""}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function teamLeague(teamName) {
  const normalized = teamName.toLowerCase();
  const team = teams.find((item) => item.name.toLowerCase() === normalized);
  return team?.league === "Diamond" ? "diamond" : "keystone";
}

function matchupSummary(away, home, scoredAway = null, scoredHome = null) {
  return `
    <section class="game-summary-sheet" aria-label="Team summary">
      <table>
        <thead>
          <tr>
            <th>Team</th>
            ${game1Data.days.map((day) => `<th>${day}</th>`).join("")}
            <th>Sheet</th>
            ${scoredAway || scoredHome ? "<th>MLB</th><th>Diff</th>" : ""}
            <th>Offense</th>
            <th>Pitching</th>
            <th>Lead</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRow(away, "Away", scoredAway)}
          ${summaryRow(home, "Home", scoredHome)}
        </tbody>
      </table>
    </section>
  `;
}

function summaryRow(team, side, scoredTeam = null) {
  const calculated = scoredTeam ? formatPoints(scoredTeam.calculated) : "";
  const diff = scoredTeam ? formatPoints(scoredTeam.calculated - team.summary.score) : "";
  const sheetDaily = teamDailyTotals(team);
  const calculatedDaily = scoredTeam ? teamDailyTotals(scoredTeam, "calculatedDaily") : null;
  return `
    <tr class="${side === "Home" ? "is-home" : "is-away"}">
      <th><span>${escapeHtml(side)}</span>${escapeHtml(team.team)}</th>
      ${game1Data.days.map((day) => summaryDailyCell(sheetDaily[day], calculatedDaily?.[day])).join("")}
      <td>${formatPoints(displayedSheetPoints(team.summary.score))}</td>
      ${scoredTeam ? `<td>${calculated}</td><td class="${Number(diff) === 0 ? "" : "is-diff"}">${diff}</td>` : ""}
      <td>${formatPoints(displayedSheetPoints(team.summary.offense))}</td>
      <td>${formatPoints(displayedSheetPoints(team.summary.pitching))}</td>
      <td>${team.summary.lead ? formatPoints(displayedSheetPoints(team.summary.lead)) : ""}</td>
    </tr>
  `;
}

function teamDailyTotals(team, key = "daily") {
  return team.players.reduce((totals, row) => addStats(totals, row[key] || {}), {});
}

function summaryDailyCell(sheet, calculated) {
  const sheetValue = displayedSheetPoints(sheet);
  if (!Number.isFinite(calculated)) return `<td>${formatPoints(sheetValue || 0)}</td>`;
  const diff = number(calculated) - sheetValue;
  return `
    <td class="game-daily-compare ${diff ? "is-diff" : ""}">
      <span>${formatPoints(sheetValue || 0)}</span>
      <span>${formatPoints(calculated || 0)}</span>
      <strong>${diff ? formatPoints(diff) : ""}</strong>
    </td>
  `;
}

function teamPanel(team, scoredTeam = null, side = "") {
  const rows = scoredTeam?.rows || team.players;
  const calculated = scoredTeam ? formatPoints(scoredTeam.calculated) : "Pending";
  const delta = scoredTeam ? formatPoints(scoredTeam.calculated - team.summary.score) : "";
  return `
    <section class="game-team-panel">
      <header>
        <h3><span>${escapeHtml(side)}</span>${escapeHtml(team.team)}</h3>
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
        ${playerNameHtml(row)}
      </td>
      ${game1Data.days.map((day) => dailyCompareCell(
        row.daily[day],
        row.calculatedDaily?.[day],
        row.details?.[day],
        `${row.name} / ${day}`,
        substitutionClassForDay(row, day)
      )).join("")}
      <td>${row.total}</td>
      <td>${calculated}</td>
      <td class="${Number(diff) === 0 ? "" : "is-diff"}">${diff}</td>
    </tr>
  `;
}

function playerNameHtml(row) {
  if (!row.substitutions || row.substitutions.length <= 1) return `<strong>${escapeHtml(row.name)}</strong>`;
  return `
    <div class="game-player-sub-tags">
      ${row.substitutions.map((segment, index) => `
        <span class="game-sub-color-${index % 6}">
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
  return index >= 0 ? `game-sub-day game-sub-color-${index % 6}` : "";
}

function dailyCompareCell(sheet, calculated, details = null, title = "", dayClass = "") {
  const sheetValue = displayedSheetPoints(sheet);
  if (!Number.isFinite(calculated)) return `<td class="${dayClass}">${sheetValue || ""}</td>`;
  const calculatedValue = number(calculated);
  const diff = calculatedValue - sheetValue;
  const detailId = details?.length ? registerDetail(title, details, sheetValue, calculatedValue, diff) : "";
  return `
    <td class="game-daily-compare ${dayClass} ${diff ? "is-diff" : ""}">
      <span>${sheetValue ? formatPoints(sheetValue) : ""}</span>
      <span>${detailId ? `<button type="button" data-detail-id="${detailId}">${calculatedValue ? formatPoints(calculatedValue) : "0"}</button>` : calculatedValue ? formatPoints(calculatedValue) : ""}</span>
      <strong>${diff ? formatPoints(diff) : ""}</strong>
    </td>
  `;
}

function resetDetails() {
  detailStore.clear();
  detailCounter = 0;
}

function registerDetail(title, entries, sheet, calculated, diff) {
  const id = `detail-${++detailCounter}`;
  detailStore.set(id, { title, entries, sheet, calculated, diff });
  return id;
}

function showDetail(id) {
  const detail = detailStore.get(id);
  if (!detail) return;
  detailTitle.textContent = detail.title;
  detailBody.innerHTML = `
    <div class="game-detail-totals">
      <span>Sheet <strong>${formatPoints(detail.sheet)}</strong></span>
      <span>MLB <strong>${formatPoints(detail.calculated)}</strong></span>
      <span>Diff <strong>${detail.diff ? formatPoints(detail.diff) : ""}</strong></span>
    </div>
    ${detail.entries.map(detailEntryHtml).join("") || "<p class=\"admin-note\">No scoring events found.</p>"}
  `;
  detailDialog.showModal();
}

function detailEntryHtml(entry) {
  return `
    <section class="game-detail-entry">
      <h3>${escapeHtml(entry.player)}</h3>
      <p>${escapeHtml(entry.date)} ${entry.opponent ? `vs ${escapeHtml(entry.opponent)}` : ""} ${entry.summary ? ` / ${escapeHtml(entry.summary)}` : ""}</p>
      <table>
        <thead>
          <tr><th>Event</th><th>Count</th><th>Pts</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${entry.items.map((item) => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${formatPoints(item.count)}</td>
              <td>${formatPoints(item.points)}</td>
              <td>${formatPoints(truncatePoints(item.total))}</td>
            </tr>
          `).join("")}
          ${entry.doubled ? `<tr class="is-sp-double"><td colspan="3">SP one-start double</td><td>${formatPoints(entry.points)}</td></tr>` : ""}
          ${entry.floored ? `<tr class="is-sp-double"><td colspan="3">Negative total floored to zero</td><td>0</td></tr>` : ""}
        </tbody>
      </table>
      <strong>Total ${formatPoints(entry.points)}</strong>
    </section>
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
    resetDetails();
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
      ${spreadsheetMatchupSummary(matchup)}
      ${matchupSummary(matchup.away, matchup.home, away, home)}
      <div class="game-team-panels">
        ${teamPanel(matchup.away, away, "Away")}
        ${teamPanel(matchup.home, home, "Home")}
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
matchupDetail.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail-id]");
  if (button) showDetail(button.dataset.detailId);
});
detailClose.addEventListener("click", () => detailDialog.close());

init();
