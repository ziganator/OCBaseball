import { getSession, getSupabaseClient } from "./auth.js";

const API_ROOT = "https://statsapi.mlb.com/api/v1";
const ESPN_NEWS_ROOT = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news";
const STORAGE_KEY = "ownersclub.highlandersLineup";
const PLAYER_ID_KEY = "ownersclub.highlandersMlbPlayerIds";
const SEASON_START = "2026-03-26";
const SEASON = "2026";
const TEAM_SLUG = "cleveland-highlanders";

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
  { id: "mackenzie-gore", mlbId: 669022, name: "MacKenzie Gore", positions: ["SP"], mlb: "TEX" },
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
const prevDayEl = document.querySelector("#lineup-prev-day");
const nextDayEl = document.querySelector("#lineup-next-day");
const rangeEl = document.querySelector("#lineup-range");
const windowLabelEl = document.querySelector("#lineup-window-label");
const statusEl = document.querySelector("#lineup-status");
const hitterBodyEl = document.querySelector("#hitter-table-body");
const pitcherBodyEl = document.querySelector("#pitcher-table-body");
const hitterHeaderEl = document.querySelector("#hitter-table-header");
const pitcherHeaderEl = document.querySelector("#pitcher-table-header");
const mobileToggleEl = document.querySelector("#lineup-mobile-toggle");
const hittingTotalEl = document.querySelector("#hitting-total");
const pitchingTotalEl = document.querySelector("#pitching-total");
const teamTotalEl = document.querySelector("#team-total");
const playerDialog = document.querySelector("#player-dialog");
const playerDialogTitle = document.querySelector("#player-dialog-title");
const playerDialogBody = document.querySelector("#player-dialog-body");
const positionDialog = document.querySelector("#position-dialog");
const positionDialogTitle = document.querySelector("#position-dialog-title");
const positionDialogBody = document.querySelector("#position-dialog-body");
let draggingPlayerId = "";

const playerIdCache = loadJson(PLAYER_ID_KEY, {});
const dataState = {
  ready: false,
  logs: {},
  games: {},
  statuses: {},
  news: null,
  errors: []
};
let state = loadState();
let supabase = null;
let session = null;
let loadingLineupDate = "";
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
  const date = saved.date || todayString();
  const lineups = saved.lineups || {};
  const localMatch = localLineupForDate(lineups, date);
  return {
    date,
    range: saved.range || "day",
    lineups,
    lineup: sanitizeLineup(localMatch.lineup || saved.lineup || defaultLineup)
  };
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function localLineupForDate(lineups, date) {
  let bestDate = "";
  let lineup = null;
  for (const [lineupDate, savedLineup] of Object.entries(lineups || {})) {
    if (lineupDate <= date && lineupDate > bestDate) {
      bestDate = lineupDate;
      lineup = savedLineup;
    }
  }
  return { date: bestDate, lineup };
}

function playerIdForLineupValue(value) {
  const text = String(value || "");
  if (!text) return "";
  return allPlayers().find((player) => (
    player.id === text || slugify(player.name) === slugify(text)
  ))?.id || "";
}

function sanitizeLineup(lineup) {
  const next = { ...defaultLineup, ...lineup };
  for (const slot of [...hitterSlots, ...pitcherSlots]) {
    next[slot.code] = playerIdForLineupValue(next[slot.code]) || defaultLineup[slot.code] || "";
  }
  if (!next["2B"]) next["2B"] = defaultLineup["2B"];
  return next;
}

function saveState(message, options = {}) {
  saveLocalState();
  if (!options.skipRemote) saveLineupToDatabase();
  if (message) statusEl.textContent = message;
}

function saveLocalState() {
  state.lineups = { ...(state.lineups || {}), [state.date]: sanitizeLineup(state.lineup) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: state.date,
    range: state.range,
    lineup: state.lineup,
    lineups: state.lineups
  }));
}

async function initLineupStorage() {
  try {
    supabase = await getSupabaseClient();
    session = await getSession();
  } catch {
    supabase = null;
    session = null;
  }

  await loadLineupForDate(state.date);
}

async function loadLineupForDate(date) {
  const localMatch = localLineupForDate(state.lineups || {}, date);
  const localLineup = state.lineups?.[date] || localMatch.lineup || defaultLineup;
  let lineup = localLineup;
  loadingLineupDate = date;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("team_daily_lineups")
        .select("lineup,lineup_date")
        .eq("team_slug", TEAM_SLUG)
        .lte("lineup_date", date)
        .order("lineup_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data?.lineup) lineup = data.lineup;
    } catch {
      lineup = localLineup;
    }
  }

  if (loadingLineupDate !== date) return;
  state.lineup = sanitizeLineup(lineup);
  state.lineups = { ...(state.lineups || {}), [date]: state.lineup };
  saveLocalState();
}

async function saveLineupToDatabase() {
  if (!supabase || !session?.user || !state.date) return;
  const lineupDate = state.date;
  const lineup = sanitizeLineup(state.lineup);
  try {
    const { error } = await supabase
      .from("team_daily_lineups")
      .upsert({
        team_slug: TEAM_SLUG,
        lineup_date: lineupDate,
        lineup,
        updated_by: session.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "team_slug,lineup_date" });

    if (error) throw error;
  } catch {
    // Local storage remains the fallback until the Supabase migration is run.
  }
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  dataState.statuses = {};
  dataState.errors = [];

  await resolvePlayerIds();
  const players = allPlayers().filter((player) => playerIdCache[player.id]);
  await Promise.all([loadRosterStatuses(), ...players.map(loadPlayerLog)]);
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

async function loadRosterStatuses() {
  try {
    const teamsData = await fetchJson(`${API_ROOT}/teams?sportId=1&season=${SEASON}`);
    const teamByAbbr = new Map((teamsData.teams || []).map((team) => [teamAbbr(team), team.id]));
    const rosterTeamIds = [...new Set(allPlayers().map((player) => teamByAbbr.get(player.mlb)).filter(Boolean))];
    const rosters = await Promise.all(rosterTeamIds.map(async (teamId) => {
      try {
        const roster = await fetchJson(`${API_ROOT}/teams/${teamId}/roster?rosterType=40Man&hydrate=person`);
        return roster.roster || [];
      } catch {
        return [];
      }
    }));
    const statusByMlbId = new Map();
    for (const rosterEntry of rosters.flat()) {
      statusByMlbId.set(rosterEntry.person?.id, rosterEntry.status || null);
    }
    for (const player of allPlayers()) {
      dataState.statuses[player.id] = normalizePlayerStatus(statusByMlbId.get(playerIdCache[player.id]));
    }
  } catch (error) {
    dataState.errors.push("player roster statuses");
  }
}

function normalizePlayerStatus(status) {
  if (!status) return "NA";
  const code = String(status.code || "").toUpperCase();
  const description = String(status.description || "");
  if (code === "A" || description.toLowerCase() === "active") return "";
  if (code === "DTD" || description.toLowerCase().includes("day-to-day")) return "DTD";
  if (description.toLowerCase().includes("injured") || /^D\d+/.test(code)) {
    const days = code.match(/\d+/)?.[0];
    return days ? `IL-${days}` : "IL";
  }
  if (["RM", "FA", "OUT"].includes(code) || description.toLowerCase().includes("reassigned")) return "NA";
  return code || description;
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
  const playerStats = playerBox?.stats?.[player.group === "pitcher" ? "pitching" : "batting"] || {};
  const gameStarted = game.status?.abstractGameState !== "Preview";
  const gameFinal = game.status?.abstractGameState === "Final";
  const scoreMine = game.teams[side]?.score;
  const scoreOpp = game.teams[otherSide]?.score;
  const hasScore = Number.isFinite(scoreMine) && Number.isFinite(scoreOpp);
  const result = hasScore && gameFinal ? `${scoreMine > scoreOpp ? "W" : "L"} ${scoreMine}-${scoreOpp}` : "";
  const liveScore = hasScore && gameStarted && !gameFinal ? `${scoreMine}-${scoreOpp} ${inningLabel(game.linescore)}`.trim() : "";
  const gameTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(game.gameDate));
  const battingOrder = playerBox?.battingOrder ? Math.floor(Number.parseInt(playerBox.battingOrder, 10) / 100) : null;
  const probablePitcherId = game.teams[side]?.probablePitcher?.id;
  const scheduledStarter = player.group === "pitcher"
    && player.positions.includes("SP")
    && probablePitcherId === playerIdCache[player.id];
  const position = player.group === "pitcher" ? "" : battingOrder ? `Batting ${ordinal(battingOrder)}` : "";
  const lineupReleased = Boolean(boxscore?.teams?.[side]?.batters?.length || playerBox?.battingOrder);
  const lineupOut = player.group === "hitter" && lineupReleased && !battingOrder;
  return {
    opponent,
    status: game.status?.abstractGameState || "",
    detail: game.status?.detailedState || "",
    summary: playerStats.summary || "",
    battingOrder,
    lineupOut,
    decisions: pitcherDecisions(playerStats),
    scheduledStarter,
    gameStarted,
    gameInProgress: gameStarted && !gameFinal,
    line: gameStarted
      ? `${result || liveScore || game.status?.detailedState || "In progress"} ${isHome ? "vs" : "@"} ${opponent}`
      : `${gameTime} ${isHome ? "vs" : "@"} ${opponent}`,
    lineup: gameStarted
      ? position
      : position
  };
}

function inningLabel(linescore) {
  if (!linescore?.currentInning) return "";
  const half = linescore.isTopInning ? "Top" : "Bottom";
  return `${half} ${linescore.currentInning}`;
}

function pitcherDecisions(stats) {
  const decisions = [];
  if (number(stats.wins)) decisions.push("W");
  if (number(stats.losses)) decisions.push("L");
  if (number(stats.saves)) decisions.push("SV");
  return decisions;
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
    atBats: number(stat.atBats),
    hits,
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
    groundIntoDoublePlay: number(stat.groundIntoDoublePlay),
    cycle: number(stat.cycle),
    grandSlams: number(stat.grandSlams)
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
  if (!splits.length) return "";
  const stats = aggregateStats(player, splits);
  if (player.group === "pitcher") {
    return compactStats([
      ["IP", formatInnings(stats.inningsPitchedPoints)],
      ["W", stats.wins, state.range === "day"],
      ["L", stats.losses, state.range === "day"],
      ["SV", stats.saves, state.range === "day"],
      ["HLD", stats.holds, state.range === "day"],
      ["K", stats.strikeOuts]
    ]);
  }
  return compactStats([
    ["H/AB", `${number(stats.hits)}/${number(stats.atBats)}`, true],
    ["R", stats.runs],
    ["1B", stats.singles],
    ["2B", stats.doubles],
    ["3B", stats.triples],
    ["HR", stats.homeRuns],
    ["RBI", stats.rbi],
    ["SB", stats.stolenBases],
    ["CS", stats.caughtStealing],
    ["BB", stats.baseOnBalls],
    ["HBP", stats.hitByPitch],
    ["GIDP", stats.groundIntoDoublePlay],
    ["CYC", stats.cycle],
    ["SLAM", stats.grandSlams]
  ]);
}

function compactStats(items) {
  return items
    .filter(([, value, alwaysShow]) => alwaysShow || Number(value) !== 0)
    .map(([label, value, labelOnly]) => labelOnly && Number(value) === 1 ? label : `${label} ${value}`)
    .join(" | ");
}

function formatInnings(value) {
  const whole = Math.floor(value || 0);
  const outs = Math.round(((value || 0) - whole) * 3);
  return outs ? `${whole}.${outs}` : String(whole);
}

function renderTables() {
  updateWindow();
  renderTableHeaders();
  hitterBodyEl.innerHTML = rowsFor(hitters, hitterSlots);
  pitcherBodyEl.innerHTML = rowsFor(pitchers, pitcherSlots);
  updateTotals();
}

function renderTableHeaders() {
  hitterHeaderEl.innerHTML = `
    <th>Pos</th>
    <th>Batters</th>
    <th class="lineup-stat-col">H/AB</th>
    <th class="lineup-stat-col">R</th>
    <th class="lineup-stat-col">1B</th>
    <th class="lineup-stat-col">2B</th>
    <th class="lineup-stat-col">3B</th>
    <th class="lineup-stat-col">HR</th>
    <th class="lineup-stat-col">RBI</th>
    <th class="lineup-stat-col">SB</th>
    <th class="lineup-stat-col">CS</th>
    <th class="lineup-stat-col">BB</th>
    <th class="lineup-stat-col">HBP</th>
    <th class="lineup-stat-col">GIDP</th>
    <th class="lineup-stat-col">CYC</th>
    <th class="lineup-stat-col">SLAM</th>
    <th>Fan Pts</th>
  `;
  pitcherHeaderEl.innerHTML = `
    <th>Pos</th>
    <th>Pitchers</th>
    <th class="lineup-stat-col">IP</th>
    <th class="lineup-stat-col">W</th>
    <th class="lineup-stat-col">L</th>
    <th class="lineup-stat-col">SV</th>
    <th class="lineup-stat-col">K</th>
    <th>Fan Pts</th>
  `;
}

function rowsFor(pool, slots) {
  const group = pool === pitchers ? "pitcher" : "hitter";
  const activeRows = slots.map((slot) => ({ slot, player: playerById(state.lineup[slot.code]) })).filter((row) => row.player);
  const activeIds = new Set(activeRows.map((row) => row.player.id));
  const benchRows = pool
    .filter((player) => !activeIds.has(player.id))
    .map((player) => ({ slot: { code: "BN", label: "BN", allowed: player.positions }, player: { ...player, group } }));
  return [...activeRows, ...benchRows].map(({ slot, player }) => tableRow(player, slot)).join("");
}

function tableRow(player, slot) {
  const game = dataState.games[player.id];
  const points = dataState.ready ? playerPoints(player) : 0;
  const isBench = slot.code === "BN";
  const locked = isLineupLocked(player, isBench);
  const activeLive = !isBench && Boolean(game?.gameInProgress);
  const gameLine = state.range === "day"
    ? game ? gameLineHtml(player, game) : `<span class="lineup-game-text">No game</span>`
    : "";
  return `
    <tr class="lineup-player-row ${isBench ? "is-bench" : "is-active"} ${activeLive ? "is-live" : ""} ${locked ? "is-locked" : ""}" draggable="${locked ? "false" : "true"}" data-player-id="${player.id}">
      <td class="lineup-pos-cell" data-slot="${slot.code}" data-player-id="${player.id}">
        <button class="lineup-pos-pill" type="button" data-action="position" data-slot="${slot.code}" ${locked ? "disabled" : ""}>${slotLabel(slot)}</button>
      </td>
      <td class="lineup-player-cell">
        <button class="lineup-player-button" type="button" data-action="player" data-player-id="${player.id}">
          <span class="lineup-player-main">
            <span>
              <strong class="lineup-player-name">${escapeHtml(player.name)} ${playerMetaHtml(player)}</strong>
            </span>
            <span class="lineup-player-game">${gameLine}</span>
          </span>
          <span class="lineup-player-statline">${escapeHtml(statSummary(player))}</span>
        </button>
      </td>
      ${statCells(player)}
      <td class="lineup-fantasy-points">${formatPoints(points)}</td>
    </tr>
  `;
}

function statCells(player) {
  const stats = aggregateStats(player, windowSplits(player.id));
  const values = player.group === "pitcher"
    ? [formatInnings(stats.inningsPitchedPoints), stats.wins, stats.losses, stats.saves, stats.strikeOuts]
    : [
      `${number(stats.hits)}/${number(stats.atBats)}`,
      stats.runs,
      stats.singles,
      stats.doubles,
      stats.triples,
      stats.homeRuns,
      stats.rbi,
      stats.stolenBases,
      stats.caughtStealing,
      stats.baseOnBalls,
      stats.hitByPitch,
      stats.groundIntoDoublePlay,
      stats.cycle,
      stats.grandSlams
    ];
  return values.map((value) => `<td class="lineup-stat-col">${escapeHtml(formatStatValue(value))}</td>`).join("");
}

function formatStatValue(value) {
  return Number(value) === 0 ? "" : value;
}

function playerStatusBadge(player) {
  const status = dataState.statuses[player.id];
  return status ? `<span class="lineup-status-badge">${escapeHtml(status)}</span>` : "";
}

function playerMetaHtml(player) {
  return `<span class="lineup-player-meta">${escapeHtml(player.mlb)} - ${escapeHtml(player.positions.join(", "))}</span>${playerStatusBadge(player)}`;
}

function gameLineHtml(player, game) {
  const starterBadge = game.scheduledStarter ? `<span class="lineup-starter-badge" aria-label="Scheduled starter">✓</span>` : "";
  const leadBadges = player.group === "pitcher"
    ? `${starterBadge}${game.decisions.map((decision) => `<span class="lineup-decision-badge is-${decision.toLowerCase()}">${escapeHtml(decision)}</span>`).join("")}`
    : Number.isFinite(game.battingOrder)
      ? `<span class="lineup-order-badge">${game.battingOrder}</span>`
      : game.lineupOut ? `<span class="lineup-out-badge" aria-label="Not in lineup">X</span>` : "";
  const lineup = player.group === "hitter" && Number.isFinite(game.battingOrder)
    ? ""
    : game.lineup ? `<span class="lineup-game-note">${escapeHtml(game.lineup)}</span>` : "";
  return `${leadBadges}<span class="lineup-game-text">${escapeHtml(game.line)}</span>${lineup}`;
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

function isGameStarted(player) {
  return state.range === "day" && Boolean(dataState.games[player.id]?.gameStarted);
}

function isLineupLocked(player, isBench) {
  if (!dataState.ready || state.range !== "day") return false;
  return isBench ? isGameStarted(player) : isGameStarted(player);
}

function isSlotLocked(slotCode) {
  const player = playerById(state.lineup[slotCode]);
  return player ? isLineupLocked(player, false) : false;
}

function isMoveCandidateAvailable(player) {
  const assignedSlot = playerSlot(player.id);
  if (assignedSlot) return !isSlotLocked(assignedSlot);
  return !isLineupLocked(player, true);
}

function isEligible(player, slot) {
  return slot.allowed.some((position) => player.positions.includes(position));
}

function canDropPlayer(playerId, slotCode) {
  const player = playerById(playerId);
  const slot = slotByCode(slotCode);
  if (!player || !slot || !isMoveCandidateAvailable(player)) return false;
  return isEligible(player, slot);
}

function clearDropTarget(cell) {
  cell?.classList.remove("is-valid-drop-target", "is-invalid-drop-target");
}

function playerSlot(playerId) {
  return Object.entries(state.lineup).find(([, assignedId]) => assignedId === playerId)?.[0] || "";
}

function assignPlayer(playerId, targetSlotCode) {
  const player = playerById(playerId);
  const targetSlot = slotByCode(targetSlotCode);
  if (!player || !targetSlot || !isEligible(player, targetSlot)) return;
  if (isSlotLocked(targetSlotCode)) {
    statusEl.textContent = `${slotLabel(targetSlot)} is locked because that player's game has started.`;
    return;
  }
  if (!isMoveCandidateAvailable(player)) {
    statusEl.textContent = `${player.name} is locked because his game has started.`;
    return;
  }
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
  if (isSlotLocked(slotCode)) {
    positionDialogTitle.textContent = `${slotLabel(slot)} locked`;
    positionDialogBody.innerHTML = `<p class="admin-note">This lineup spot cannot be changed because that player's MLB game has already started.</p>`;
    positionDialog.showModal();
    return;
  }
  const pool = slotCode.startsWith("SP") || slotCode.startsWith("RP") ? pitchers : hitters;
  const group = pool === pitchers ? "pitcher" : "hitter";
  const eligible = pool
    .map((player) => ({ ...player, group }))
    .filter((player) => isEligible(player, slot) && isMoveCandidateAvailable(player));
  positionDialogTitle.textContent = `Move to ${slotLabel(slot)}`;
  positionDialogBody.innerHTML = `
    <div class="lineup-option-list">
      ${eligible.map((player) => `
        <button class="lineup-option-button" type="button" data-player-id="${player.id}" data-slot="${slot.code}">
          <span>
            <strong>${escapeHtml(player.name)} <em>${escapeHtml(player.mlb)} - ${escapeHtml(player.positions.join(", "))}</em>${playerStatusBadge(player)}</strong>
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
    <div class="lineup-dialog-tabs" role="tablist" aria-label="Player detail tabs">
      <button class="is-active" type="button" data-player-tab="stats">Stats</button>
      <button type="button" data-player-tab="news">News</button>
    </div>
    <section class="lineup-dialog-panel is-active" data-player-panel="stats">
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
            ${splits.map((split) => gameLogRow(player, split)).join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="lineup-dialog-panel" data-player-panel="news">
      <div class="lineup-news-list" data-news-player-id="${player.id}"></div>
    </section>
  `;
  playerDialog.showModal();
  renderPlayerNews(player);
}

function gameLogRow(player, split) {
  const points = scoreStats(player, normalizeStats(player, split));
  return `
    <tr>
      <td>${split.date}</td>
      <td>${split.isHome ? "vs" : "@"} ${escapeHtml(split.opponent?.name || "")}</td>
      <td><span class="lineup-result-badge ${split.isWin ? "is-win" : "is-loss"}">${split.isWin ? "W" : "L"}</span></td>
      <td>${escapeHtml(split.stat?.summary || "")}</td>
      <td>${formatPoints(points)}</td>
    </tr>
  `;
}

async function loadNewsFeed() {
  if (dataState.news) return dataState.news;
  const data = await fetchJson(`${ESPN_NEWS_ROOT}?limit=100`);
  dataState.news = data.articles || [];
  return dataState.news;
}

async function renderPlayerNews(player) {
  const newsList = playerDialogBody.querySelector(`[data-news-player-id="${player.id}"]`);
  if (!newsList) return;
  newsList.innerHTML = "";
  try {
    const articles = await loadNewsFeed();
    const weekStart = new Date(`${addDays(state.date, -7)}T00:00:00`);
    const matches = articles.filter((article) => playerNewsMatch(player, article, weekStart)).slice(0, 6);
    newsList.innerHTML = matches.map(newsCard).join("");
  } catch {
    newsList.innerHTML = "";
  }
}

function playerNewsMatch(player, article, weekStart) {
  const published = new Date(article.published || article.lastModified || 0);
  if (Number.isNaN(published.getTime()) || published < weekStart) return false;
  const name = player.name.toLowerCase();
  const text = `${article.headline || ""} ${article.description || ""}`.toLowerCase();
  const categoryMatch = (article.categories || []).some((category) => (
    category.type === "athlete" && String(category.description || "").toLowerCase() === name
  ));
  return categoryMatch || text.includes(name);
}

function newsCard(article) {
  const href = article.links?.web?.href || article.link || "#";
  const published = article.published ? new Date(article.published).toLocaleDateString() : "";
  return `
    <a class="lineup-news-card" href="${escapeHtml(href)}" target="_blank" rel="noopener">
      <strong>${escapeHtml(article.headline || "")}</strong>
      <span>${escapeHtml(published)}</span>
      <p>${escapeHtml(article.description || "")}</p>
    </a>
  `;
}

document.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".lineup-player-row");
  if (!row) return;
  if (row.classList.contains("is-locked")) {
    event.preventDefault();
    return;
  }
  draggingPlayerId = row.dataset.playerId;
  event.dataTransfer.setData("text/plain", row.dataset.playerId);
  event.dataTransfer.effectAllowed = "move";
});

document.addEventListener("dragover", (event) => {
  const posCell = event.target.closest(".lineup-pos-cell");
  if (!posCell || posCell.dataset.slot === "BN" || isSlotLocked(posCell.dataset.slot)) return;
  event.preventDefault();
  const eligible = canDropPlayer(draggingPlayerId, posCell.dataset.slot);
  posCell.classList.toggle("is-valid-drop-target", eligible);
  posCell.classList.toggle("is-invalid-drop-target", !eligible);
});

document.addEventListener("dragleave", (event) => {
  clearDropTarget(event.target.closest(".lineup-pos-cell"));
});

document.addEventListener("drop", (event) => {
  const posCell = event.target.closest(".lineup-pos-cell");
  if (!posCell || posCell.dataset.slot === "BN" || isSlotLocked(posCell.dataset.slot)) return;
  event.preventDefault();
  clearDropTarget(posCell);
  assignPlayer(event.dataTransfer.getData("text/plain"), posCell.dataset.slot);
});

document.addEventListener("dragend", () => {
  draggingPlayerId = "";
  document.querySelectorAll(".lineup-pos-cell").forEach(clearDropTarget);
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

playerDialogBody.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-player-tab]");
  if (!tab) return;
  const target = tab.dataset.playerTab;
  playerDialogBody.querySelectorAll("[data-player-tab]").forEach((button) => {
    button.classList.toggle("is-active", button === tab);
  });
  playerDialogBody.querySelectorAll("[data-player-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.playerPanel === target);
  });
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog")?.close();
  });
});

dateEl.addEventListener("change", () => {
  updateLineupDate(dateEl.value || todayString());
});

prevDayEl?.addEventListener("click", () => updateLineupDate(addDays(state.date, -1)));
nextDayEl?.addEventListener("click", () => updateLineupDate(addDays(state.date, 1)));

async function updateLineupDate(value) {
  state.date = value || todayString();
  dateEl.value = state.date;
  await loadLineupForDate(state.date);
  renderTables();
  loadMlbData();
}

rangeEl.addEventListener("change", () => {
  state.range = rangeEl.value || "day";
  saveState("", { skipRemote: true });
  renderTables();
});

mobileToggleEl?.addEventListener("click", () => {
  const mobile = document.body.classList.toggle("lineup-force-mobile");
  mobileToggleEl.textContent = mobile ? "Web" : "Mobile";
});

async function boot() {
  await initLineupStorage();
  renderTables();
  await loadMlbData();
}

boot().catch((error) => {
  statusEl.textContent = `Could not load MLB data: ${error.message}`;
});
