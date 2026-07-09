const API_ROOT = "https://statsapi.mlb.com/api/v1";
const STORAGE_KEY = "ownersclub.highlandersLineup";
const PLAYER_ID_KEY = "ownersclub.highlandersMlbPlayerIds";
const SEASON_START = "2026-03-26";
const SEASON = "2026";

const hitters = [
  { id: "joe-mack", mlbId: 691788, name: "Joe Mack", positions: ["C"], mlb: "MIA" },
  { id: "michael-busch", mlbId: 683737, name: "Michael Busch", positions: ["1B", "OF"], mlb: "CHC" },
  { id: "kody-clemens", mlbId: 665019, name: "Kody Clemens", positions: ["2B", "1B", "OF"], mlb: "MIN" },
  { id: "zach-mckinstry", mlbId: 656716, name: "Zach McKinstry", positions: ["3B", "2B", "SS", "OF"], mlb: "DET" },
  { id: "bryson-stott", mlbId: 681082, name: "Bryson Stott", positions: ["2B", "SS"], mlb: "PHI" },
  { id: "gavin-sheets", mlbId: 657757, name: "Gavin Sheets", positions: ["OF", "1B"], mlb: "SD" },
  { id: "jung-hoo-lee", mlbId: 808982, name: "Jung Hoo Lee", positions: ["OF"], mlb: "SF" },
  { id: "jake-mangum", mlbId: 663968, name: "Jake Mangum", positions: ["OF"], mlb: "PIT" },
  { id: "masyn-winn", mlbId: 691026, name: "Masyn Winn", positions: ["SS"], mlb: "STL" },
  { id: "jose-caballero", mlbId: 676609, name: "Jose Caballero", positions: ["2B", "3B", "SS", "OF"], mlb: "NYY" },
  { id: "eugenio-suarez", mlbId: 553993, name: "Eugenio Suarez", positions: ["3B"], mlb: "CIN" },
  { id: "david-hamilton", mlbId: 666152, name: "David Hamilton", positions: ["2B", "SS", "OF"], mlb: "MIL" },
  { id: "trent-grisham", mlbId: 663757, name: "Trent Grisham", positions: ["OF"], mlb: "NYY" },
  { id: "sal-frelick", mlbId: 686217, name: "Sal Frelick", positions: ["OF"], mlb: "MIL" },
  { id: "austin-wells", mlbId: 669224, name: "Austin Wells", positions: ["C"], mlb: "NYY" },
  { id: "aaron-judge", mlbId: 592450, name: "Aaron Judge", positions: ["OF"], mlb: "NYY" },
  { id: "lenyn-sosa", mlbId: 672820, name: "Lenyn Sosa", positions: ["2B", "3B"], mlb: "TOR" },
  { id: "tyler-freeman", mlbId: 671289, name: "Tyler Freeman", positions: ["2B", "OF"], mlb: "COL" }
];

const pitchers = [
  { id: "jesus-luzardo", mlbId: 666200, name: "Jesus Luzardo", positions: ["SP"], mlb: "PHI" },
  { id: "logan-webb", mlbId: 657277, name: "Logan Webb", positions: ["SP"], mlb: "SF" },
  { id: "mackenzie-gore", mlbId: 669022, name: "MacKenzie Gore", positions: ["SP"], mlb: "WSH" },
  { id: "eduardo-rodriguez", mlbId: 593958, name: "Eduardo Rodriguez", positions: ["SP"], mlb: "AZ" },
  { id: "kyle-finnegan", mlbId: 640448, name: "Kyle Finnegan", positions: ["RP"], mlb: "DET" },
  { id: "antonio-senzatela", mlbId: 622608, name: "Antonio Senzatela", positions: ["SP", "RP"], mlb: "COL" },
  { id: "robert-suarez", mlbId: 663158, name: "Robert Suarez", positions: ["RP"], mlb: "ATL" },
  { id: "shane-baz", mlbId: 669358, name: "Shane Baz", positions: ["SP"], mlb: "BAL" },
  { id: "matthew-boyd", mlbId: 571510, name: "Matthew Boyd", positions: ["SP"], mlb: "CHC" },
  { id: "zack-littell", mlbId: 641793, name: "Zack Littell", positions: ["SP"], mlb: "WSH" },
  { id: "carlos-estevez", mlbId: 608032, name: "Carlos Estevez", positions: ["RP"], mlb: "KC" },
  { id: "ryan-sloan", mlbId: 815549, name: "Ryan Sloan", positions: ["SP"], mlb: "SEA" }
];

const hitterSlots = [
  { code: "C", allowed: ["C"] },
  { code: "1B", allowed: ["1B"] },
  { code: "2B", allowed: ["2B"] },
  { code: "3B", allowed: ["3B"] },
  { code: "SS", allowed: ["SS"] },
  { code: "OF1", label: "OF", allowed: ["OF"] },
  { code: "OF2", label: "OF", allowed: ["OF"] },
  { code: "OF3", label: "OF", allowed: ["OF"] },
  { code: "UTIL", allowed: ["C", "1B", "2B", "3B", "SS", "OF"] }
];

const pitcherSlots = [
  { code: "SP1", label: "SP", allowed: ["SP"] },
  { code: "SP2", label: "SP", allowed: ["SP"] },
  { code: "SP3", label: "SP", allowed: ["SP"] },
  { code: "SP4", label: "SP", allowed: ["SP"] },
  { code: "RP1", label: "RP", allowed: ["RP"] },
  { code: "RP2", label: "RP", allowed: ["RP"] }
];

const hitterRules = [
  ["runs", 1], ["singles", 1], ["doubles", 3], ["triples", 4], ["homeRuns", 4],
  ["rbi", 1], ["stolenBases", 2], ["caughtStealing", -1], ["baseOnBalls", 1],
  ["hitByPitch", 1], ["groundIntoDoublePlay", -2]
];

const pitcherRules = [
  ["inningsPitchedPoints", 1], ["wins", 4], ["losses", -2], ["completeGames", 2],
  ["shutouts", 5], ["saves", 5], ["strikeOuts", 1], ["holds", 4],
  ["reliefAppearances", 1], ["qualityStarts", 3], ["blownSaves", -1]
];

const defaultLineup = {
  C: "joe-mack",
  "1B": "michael-busch",
  "2B": "kody-clemens",
  "3B": "zach-mckinstry",
  SS: "bryson-stott",
  OF1: "gavin-sheets",
  OF2: "jung-hoo-lee",
  OF3: "jake-mangum",
  UTIL: "masyn-winn",
  SP1: "jesus-luzardo",
  SP2: "logan-webb",
  SP3: "mackenzie-gore",
  SP4: "eduardo-rodriguez",
  RP1: "kyle-finnegan",
  RP2: "antonio-senzatela"
};

const dateEl = document.querySelector("#lineup-date");
const rangeEl = document.querySelector("#lineup-range");
const windowLabelEl = document.querySelector("#lineup-window-label");
const statusEl = document.querySelector("#lineup-status");
const hitterBodyEl = document.querySelector("#hitter-table-body");
const pitcherBodyEl = document.querySelector("#pitcher-table-body");
const hittingTotalEl = document.querySelector("#hitting-total");
const pitchingTotalEl = document.querySelector("#pitching-total");
const teamTotalEl = document.querySelector("#team-total");
const playerDialog = document.querySelector("#player-dialog");
const playerDialogTitle = document.querySelector("#player-dialog-title");
const playerDialogBody = document.querySelector("#player-dialog-body");
const positionDialog = document.querySelector("#position-dialog");
const positionDialogTitle = document.querySelector("#position-dialog-title");
const positionDialogBody = document.querySelector("#position-dialog-body");

const playerIdCache = loadJson(PLAYER_ID_KEY, {});
const dataState = {
  ready: false,
  logs: {},
  games: {},
  errors: []
};
let state = loadState();
dateEl.value = state.date;
rangeEl.value = state.range;

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function loadState() {
  const saved = loadJson(STORAGE_KEY, {});
  return {
    date: saved.date || todayString(),
    range: "day",
    lineup: sanitizeLineup(saved.lineup || defaultLineup)
  };
}

function sanitizeLineup(lineup) {
  const next = { ...defaultLineup, ...lineup };
  const validIds = new Set(allPlayers().map((player) => player.id));
  for (const slot of [...hitterSlots, ...pitcherSlots]) {
    if (!validIds.has(next[slot.code])) next[slot.code] = defaultLineup[slot.code] || "";
  }
  if (!next["2B"]) next["2B"] = defaultLineup["2B"];
  return next;
}

function saveState(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (message) statusEl.textContent = message;
}

function allPlayers() {
  return [
    ...hitters.map((player) => ({ ...player, group: "hitter" })),
    ...pitchers.map((player) => ({ ...player, group: "pitcher" }))
  ];
}

function playerById(playerId) {
  return allPlayers().find((player) => player.id === playerId);
}

function slotByCode(slotCode) {
  return [...hitterSlots, ...pitcherSlots].find((slot) => slot.code === slotCode);
}

function slotLabel(slot) {
  return slot.label || slot.code;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeStart() {
  const offsets = { day: 0, week: -6, twoWeeks: -13, month: -29 };
  if (state.range === "season") return SEASON_START;
  return addDays(state.date, offsets[state.range] || 0);
}

function lastTwoMonthsStart() {
  return addDays(state.date, -60);
}

function rangeLabel() {
  const labels = {
    day: "Today",
    week: "Last 7 days",
    twoWeeks: "Last 14 days",
    month: "Last 30 days",
    season: "Full season"
  };
  return `${labels[state.range] || "Today"}: ${rangeStart()} through ${state.date}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

async function resolvePlayerIds() {
  const players = allPlayers();
  for (const player of players) {
    if (player.mlbId) {
      playerIdCache[player.id] = player.mlbId;
      continue;
    }
    if (playerIdCache[player.id]) {
      player.mlbId = playerIdCache[player.id];
      continue;
    }
    try {
      const data = await fetchJson(`${API_ROOT}/people/search?names=${encodeURIComponent(player.name)}`);
      const activeMatch = data.people?.find((person) => person.active && person.fullName.toLowerCase() === player.name.toLowerCase());
      const fallbackMatch = data.people?.find((person) => person.active) || data.people?.[0];
      if (activeMatch || fallbackMatch) {
        playerIdCache[player.id] = (activeMatch || fallbackMatch).id;
        player.mlbId = playerIdCache[player.id];
      }
    } catch (error) {
      dataState.errors.push(`${player.name}: ${error.message}`);
    }
  }
  localStorage.setItem(PLAYER_ID_KEY, JSON.stringify(playerIdCache));
}

async function loadMlbData() {
  statusEl.textContent = "Loading MLB stats and game context...";
  dataState.ready = false;
  dataState.logs = {};
  dataState.games = {};
  dataState.errors = [];

  await resolvePlayerIds();
  const players = allPlayers().filter((player) => playerIdCache[player.id]);
  await Promise.all(players.map(loadPlayerLog));
  await loadScheduleContext();
  dataState.ready = true;
  renderTables();
  statusEl.textContent = dataState.errors.length
    ? `Loaded with ${dataState.errors.length} missing player/data item${dataState.errors.length === 1 ? "" : "s"}.`
    : "Loaded live MLB data.";
}

async function loadPlayerLog(player) {
  const group = player.group === "pitcher" ? "pitching" : "hitting";
  try {
    const data = await fetchJson(`${API_ROOT}/people/${playerIdCache[player.id]}/stats?stats=gameLog&group=${group}&season=${SEASON}`);
    dataState.logs[player.id] = data.stats?.[0]?.splits || [];
  } catch (error) {
    dataState.logs[player.id] = [];
    dataState.errors.push(`${player.name} game log`);
  }
}

async function loadScheduleContext() {
  const data = await fetchJson(`${API_ROOT}/schedule?sportId=1&date=${state.date}&hydrate=probablePitcher,team,linescore`);
  const games = data.dates?.[0]?.games || [];
  const rosterTeams = new Set(allPlayers().map((player) => player.mlb));
  const relevantGames = games.filter((game) => rosterTeams.has(teamAbbr(game.teams.away.team)) || rosterTeams.has(teamAbbr(game.teams.home.team)));
  const boxscores = await Promise.all(relevantGames.map(async (game) => {
    try {
      return { game, boxscore: await fetchJson(`${API_ROOT}/game/${game.gamePk}/boxscore`) };
    } catch {
      return { game, boxscore: null };
    }
  }));

  for (const player of allPlayers()) {
    const gameBundle = boxscores.find(({ game }) => {
      const away = teamAbbr(game.teams.away.team);
      const home = teamAbbr(game.teams.home.team);
      return away === player.mlb || home === player.mlb;
    });
    dataState.games[player.id] = gameBundle ? playerGameContext(player, gameBundle.game, gameBundle.boxscore) : null;
  }
}

function teamAbbr(team) {
  return team.abbreviation || team.fileCode?.toUpperCase() || team.name;
}

function playerGameContext(player, game, boxscore) {
  const away = teamAbbr(game.teams.away.team);
  const home = teamAbbr(game.teams.home.team);
  const isHome = home === player.mlb;
  const side = isHome ? "home" : "away";
  const otherSide = isHome ? "away" : "home";
  const opponent = isHome ? away : home;
  const playerBox = boxscore?.teams?.[side]?.players?.[`ID${playerIdCache[player.id]}`];
  const gameStarted = game.status?.abstractGameState !== "Preview";
  const gameFinal = game.status?.abstractGameState === "Final";
  const scoreMine = game.teams[side]?.score;
  const scoreOpp = game.teams[otherSide]?.score;
  const hasScore = Number.isFinite(scoreMine) && Number.isFinite(scoreOpp);
  const result = hasScore && gameFinal ? `${scoreMine > scoreOpp ? "W" : "L"} ${scoreMine}-${scoreOpp}` : "";
  const gameTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(game.gameDate));
  const battingOrder = playerBox?.battingOrder ? Number.parseInt(playerBox.battingOrder, 10) / 100 : null;
  const probablePitcherId = game.teams[side]?.probablePitcher?.id;
  const position = player.group === "pitcher"
    ? probablePitcherId === playerIdCache[player.id] ? "Probable SP" : ""
    : battingOrder ? `Batting ${ordinal(battingOrder)}` : "";
  const lineupReleased = Boolean(boxscore?.teams?.[side]?.batters?.length || playerBox?.battingOrder);
  return {
    opponent,
    status: game.status?.abstractGameState || "",
    detail: game.status?.detailedState || "",
    summary: playerBox?.stats?.[player.group === "pitcher" ? "pitching" : "batting"]?.summary || "",
    line: gameStarted
      ? `${result || game.status?.detailedState || "In progress"} ${isHome ? "vs" : "@"} ${opponent}`
      : `${gameTime} ${isHome ? "vs" : "@"} ${opponent}`,
    lineup: gameStarted
      ? position
      : lineupReleased ? (position || "X") : "Lineup not released"
  };
}

function ordinal(number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = number % 100;
  return `${number}${suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]}`;
}

function windowSplits(playerId, start = rangeStart(), end = state.date) {
  return (dataState.logs[playerId] || []).filter((split) => split.date >= start && split.date <= end);
}

function normalizeStats(player, split) {
  const stat = split.stat || {};
  if (player.group === "pitcher") {
    return {
      inningsPitchedPoints: inningsToNumber(stat.inningsPitched),
      wins: number(stat.wins),
      losses: number(stat.losses),
      completeGames: number(stat.completeGames),
      shutouts: number(stat.shutouts),
      saves: number(stat.saves),
      strikeOuts: number(stat.strikeOuts),
      holds: number(stat.holds),
      reliefAppearances: reliefAppearance(player, split),
      qualityStarts: qualityStart(stat),
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

function number(value) {
  return Number(value || 0);
}

function inningsToNumber(value) {
  if (!value) return 0;
  const [whole, outs] = String(value).split(".").map((part) => Number(part || 0));
  return whole + (outs || 0) / 3;
}

function reliefAppearance(player, split) {
  if (!player.positions.includes("RP")) return 0;
  return split.stat?.gamesPlayed ? 1 : 0;
}

function qualityStart(stat) {
  const ip = inningsToNumber(stat.inningsPitched);
  return ip >= 6 && number(stat.earnedRuns) <= 3 ? 1 : 0;
}

function aggregateStats(player, splits) {
  return splits.reduce((totals, split) => {
    const stats = normalizeStats(player, split);
    for (const [key, value] of Object.entries(stats)) {
      totals[key] = (totals[key] || 0) + value;
    }
    return totals;
  }, {});
}

function scoreStats(player, stats) {
  const rules = player.group === "pitcher" ? pitcherRules : hitterRules;
  return rules.reduce((total, [key, points]) => total + number(stats[key]) * points, 0);
}

function playerPoints(player, start = rangeStart(), end = state.date) {
  return scoreStats(player, aggregateStats(player, windowSplits(player.id, start, end)));
}

function statSummary(player) {
  const splits = windowSplits(player.id);
  if (!splits.length) return "No stats in this window.";
  const stats = aggregateStats(player, splits);
  if (player.group === "pitcher") {
    return compactStats([
      ["G", splits.length],
      ["IP", formatInnings(stats.inningsPitchedPoints)],
      ["W", stats.wins],
      ["SV", stats.saves],
      ["HLD", stats.holds],
      ["K", stats.strikeOuts]
    ]);
  }
  return compactStats([
    ["G", splits.length],
    ["R", stats.runs],
    ["1B", stats.singles],
    ["2B", stats.doubles],
    ["3B", stats.triples],
    ["HR", stats.homeRuns],
    ["RBI", stats.rbi],
    ["SB", stats.stolenBases]
  ]);
}

function compactStats(items) {
  return items
    .filter(([, value], index) => index === 0 || Number(value) !== 0)
    .map(([label, value]) => `${label} ${value}`)
    .join(" | ");
}

function formatInnings(value) {
  const whole = Math.floor(value || 0);
  const outs = Math.round(((value || 0) - whole) * 3);
  return outs ? `${whole}.${outs}` : String(whole);
}

function renderTables() {
  updateWindow();
  hitterBodyEl.innerHTML = rowsFor(hitters, hitterSlots);
  pitcherBodyEl.innerHTML = rowsFor(pitchers, pitcherSlots);
  updateTotals();
}

function rowsFor(pool, slots) {
  const activeRows = slots.map((slot) => ({ slot, player: playerById(state.lineup[slot.code]) })).filter((row) => row.player);
  const activeIds = new Set(activeRows.map((row) => row.player.id));
  const benchRows = pool
    .filter((player) => !activeIds.has(player.id))
    .map((player) => ({ slot: { code: "BN", label: "BN", allowed: player.positions }, player }));
  return [...activeRows, ...benchRows].map(({ slot, player }) => tableRow(player, slot)).join("");
}

function tableRow(player, slot) {
  const game = dataState.games[player.id];
  const points = dataState.ready ? playerPoints(player) : 0;
  const isBench = slot.code === "BN";
  const gameLine = state.range === "day"
    ? game ? `${game.line}${game.lineup ? ` | ${game.lineup}` : ""}` : "No MLB game found for this date."
    : "";
  return `
    <tr class="lineup-player-row ${isBench ? "is-bench" : "is-active"}" draggable="true" data-player-id="${player.id}">
      <td class="lineup-pos-cell" data-slot="${slot.code}" data-player-id="${player.id}">
        <button class="lineup-pos-pill" type="button" data-action="position" data-slot="${slot.code}">${slotLabel(slot)}</button>
      </td>
      <td class="lineup-player-cell">
        <button class="lineup-player-button" type="button" data-action="player" data-player-id="${player.id}">
          <span class="lineup-player-main">
            <span>
              <strong>${player.name} <em>${player.mlb} - ${player.positions.join(", ")}</em></strong>
            </span>
            <span class="lineup-player-statline">${statSummary(player)}</span>
          </span>
          ${gameLine ? `<span class="lineup-game-line">${gameLine}</span>` : ""}
        </button>
      </td>
      <td class="lineup-fantasy-points">${formatPoints(points)}</td>
    </tr>
  `;
}

function formatPoints(points) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function activePlayerIds(slots) {
  return slots.map((slot) => state.lineup[slot.code]).filter(Boolean);
}

function updateTotals() {
  const hitting = activePlayerIds(hitterSlots).reduce((total, playerId) => total + playerPoints(playerById(playerId)), 0);
  const pitching = activePlayerIds(pitcherSlots).reduce((total, playerId) => total + playerPoints(playerById(playerId)), 0);
  hittingTotalEl.textContent = formatPoints(hitting);
  pitchingTotalEl.textContent = formatPoints(pitching);
  teamTotalEl.textContent = formatPoints(hitting + pitching);
}

function updateWindow() {
  windowLabelEl.textContent = rangeLabel();
  rangeEl.value = state.range;
}

function isEligible(player, slot) {
  return slot.allowed.some((position) => player.positions.includes(position));
}

function playerSlot(playerId) {
  return Object.entries(state.lineup).find(([, assignedId]) => assignedId === playerId)?.[0] || "";
}

function assignPlayer(playerId, targetSlotCode) {
  const player = playerById(playerId);
  const targetSlot = slotByCode(targetSlotCode);
  if (!player || !targetSlot || !isEligible(player, targetSlot)) return;
  const oldSlotCode = playerSlot(playerId);
  const replacedPlayerId = state.lineup[targetSlotCode];
  if (oldSlotCode) state.lineup[oldSlotCode] = replacedPlayerId || "";
  state.lineup[targetSlotCode] = playerId;
  renderTables();
  saveState(`${player.name} moved to ${slotLabel(targetSlot)}.`);
}

function openPositionDialog(slotCode) {
  const slot = slotByCode(slotCode);
  if (!slot) return;
  const pool = slotCode.startsWith("SP") || slotCode.startsWith("RP") ? pitchers : hitters;
  const eligible = pool.filter((player) => isEligible(player, slot));
  positionDialogTitle.textContent = `Move to ${slotLabel(slot)}`;
  positionDialogBody.innerHTML = `
    <div class="lineup-option-list">
      ${eligible.map((player) => `
        <button class="lineup-option-button" type="button" data-player-id="${player.id}" data-slot="${slot.code}">
          <span>
            <strong>${player.name} <em>${player.mlb} - ${player.positions.join(", ")}</em></strong>
          </span>
          <span class="lineup-option-points">${formatPoints(playerPoints(player))} pts</span>
          <span class="lineup-option-current">${playerSlot(player.id) ? `Currently ${slotLabel(slotByCode(playerSlot(player.id)) || { code: "BN" })}` : "Bench"}</span>
        </button>
      `).join("")}
    </div>
  `;
  positionDialog.showModal();
}

function openPlayerDialog(playerId) {
  const player = playerById(playerId);
  if (!player) return;
  const splits = windowSplits(player.id, lastTwoMonthsStart(), state.date).slice().reverse();
  playerDialogTitle.textContent = `${player.name} - Last 2 Months`;
  playerDialogBody.innerHTML = `
    <div class="table-wrap lineup-dialog-table-wrap">
      <table class="lineup-dialog-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opp</th>
            <th>Result</th>
            <th>Summary</th>
            <th>Fan Pts</th>
          </tr>
        </thead>
        <tbody>
          ${splits.length ? splits.map((split) => gameLogRow(player, split)).join("") : `<tr><td colspan="5">No games found.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  playerDialog.showModal();
}

function gameLogRow(player, split) {
  const points = scoreStats(player, normalizeStats(player, split));
  return `
    <tr>
      <td>${split.date}</td>
      <td>${split.isHome ? "vs" : "@"} ${split.opponent?.name || ""}</td>
      <td>${split.isWin ? "W" : "L"}</td>
      <td>${split.stat?.summary || ""}</td>
      <td>${formatPoints(points)}</td>
    </tr>
  `;
}

document.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".lineup-player-row");
  if (!row) return;
  event.dataTransfer.setData("text/plain", row.dataset.playerId);
  event.dataTransfer.effectAllowed = "move";
});

document.addEventListener("dragover", (event) => {
  const posCell = event.target.closest(".lineup-pos-cell");
  if (!posCell || posCell.dataset.slot === "BN") return;
  event.preventDefault();
  posCell.classList.add("is-drop-target");
});

document.addEventListener("dragleave", (event) => {
  event.target.closest(".lineup-pos-cell")?.classList.remove("is-drop-target");
});

document.addEventListener("drop", (event) => {
  const posCell = event.target.closest(".lineup-pos-cell");
  if (!posCell || posCell.dataset.slot === "BN") return;
  event.preventDefault();
  posCell.classList.remove("is-drop-target");
  assignPlayer(event.dataTransfer.getData("text/plain"), posCell.dataset.slot);
});

document.addEventListener("click", (event) => {
  const positionButton = event.target.closest("[data-action='position']");
  if (positionButton) {
    openPositionDialog(positionButton.dataset.slot);
    return;
  }
  const playerButton = event.target.closest("[data-action='player']");
  if (playerButton) {
    openPlayerDialog(playerButton.dataset.playerId);
  }
});

positionDialogBody.addEventListener("click", (event) => {
  const button = event.target.closest(".lineup-option-button");
  if (!button) return;
  assignPlayer(button.dataset.playerId, button.dataset.slot);
  positionDialog.close();
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog")?.close();
  });
});

dateEl.addEventListener("change", () => {
  state.date = dateEl.value || todayString();
  saveState();
  renderTables();
  loadMlbData();
});

rangeEl.addEventListener("change", () => {
  state.range = rangeEl.value || "day";
  saveState();
  renderTables();
});

renderTables();
loadMlbData().catch((error) => {
  statusEl.textContent = `Could not load MLB data: ${error.message}`;
});
