import { getSupabaseClient, requireSession } from "./auth.js";

const API_ROOT = "https://statsapi.mlb.com/api/v1";
const ESPN_NEWS_ROOT = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news";
const SEASON = "2026";
const SEASON_START = "2026-03-26";
const PLAYER_ID_KEY = "ownersclub.rosterMlbPlayerIds";
const LEAGUES = ["Keystone", "Diamond"];
const CHUNK_SIZE = 80;

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

const slotOrder = {
  C: 10, "1B": 20, "2B": 30, "3B": 40, SS: 50,
  OF1: 60, OF2: 70, OF3: 80, DH: 90, UTIL: 90,
  SP1: 100, SP2: 110, SP3: 120, SP4: 130,
  RP1: 140, RP2: 150, BN: 900
};

const positionOrder = { C: 10, "1B": 20, "2B": 30, "3B": 40, SS: 50, OF: 60, DH: 70, SP: 80, RP: 90 };

const searchEl = document.querySelector("#rosters-search");
const teamEl = document.querySelector("#rosters-team");
const dateEl = document.querySelector("#rosters-date");
const prevDayEl = document.querySelector("#rosters-prev-day");
const nextDayEl = document.querySelector("#rosters-next-day");
const rangeEl = document.querySelector("#rosters-range");
const titleEl = document.querySelector("#rosters-title");
const subtitleEl = document.querySelector("#rosters-subtitle");
const leagueTabsEl = document.querySelector("#rosters-league-tabs");
const windowLabelEl = document.querySelector("#rosters-window-label");
const statusEl = document.querySelector("#rosters-status");
const gridEl = document.querySelector("#rosters-grid");
const playerDialog = document.querySelector("#player-dialog");
const playerDialogTitle = document.querySelector("#player-dialog-title");
const playerDialogBody = document.querySelector("#player-dialog-body");

const query = new URLSearchParams(window.location.search);
let session = null;
let supabase = null;
let rosterRows = [];
let lineupByTeamSlug = new Map();
let lineupDateByTeamSlug = new Map();
let statsByPlayerId = new Map();
let peopleByPlayerId = new Map();
let gameByPlayerId = new Map();
let statusByPlayerId = new Map();
let newsArticles = null;
let activePlayerLookup = null;
let ownTeamIds = new Set();
let accessibleLeagues = [];
let isAdmin = false;
let lineupSubscription = null;
let lineupRefreshTimer = 0;
let state = {
  league: normalizeLeague(query.get("league")),
  date: query.get("date") || todayString(),
  range: query.get("range") || "day"
};

dateEl.value = state.date;
rangeEl.value = state.range;

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeLeague(value) {
  const text = String(value || "").toLowerCase();
  return LEAGUES.find((league) => league.toLowerCase() === text) || "";
}

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

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeMlbTeamAbbr(value) {
  const text = String(value || "").toUpperCase();
  const aliases = {
    ARI: "AZ",
    CHW: "CWS",
    OAK: "ATH",
    WAS: "WSH",
    WSN: "WSH"
  };
  return aliases[text] || text;
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

function lastTwoMonthsStart() {
  return addDays(state.date, -60);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

function playerType(row) {
  const positions = positionsFor(row);
  return positions.includes("SP") || positions.includes("RP") ? "pitcher" : "hitter";
}

function positionsFor(row) {
  return Array.isArray(row.eligible_positions) && row.eligible_positions.length
    ? row.eligible_positions
    : [row.primary_position].filter(Boolean);
}

function formatPositions(row) {
  return positionsFor(row).join(", ");
}

function slotLabel(slotCode) {
  if (slotCode === "OF1" || slotCode === "OF2" || slotCode === "OF3") return "OF";
  if (slotCode === "UTIL") return "DH";
  return slotCode || "BN";
}

function positionSort(row) {
  return positionOrder[String(row.primary_position || "").toUpperCase()] || 999;
}

function loadCachedPlayerIds() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_ID_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCachedPlayerIds(cache) {
  localStorage.setItem(PLAYER_ID_KEY, JSON.stringify(cache));
}

async function loadViewerAccess() {
  const [profileResult, assignmentsResult] = await Promise.all([
    supabase.from("public_user_admin").select("is_admin").eq("user_id", session.user.id).maybeSingle(),
    supabase
      .from("public_team_owner_assignments")
      .select("team_id,team_name,league_code,active")
      .eq("user_id", session.user.id)
      .eq("active", true)
  ]);

  if (profileResult.error) throw profileResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  isAdmin = Boolean(profileResult.data?.is_admin);
  ownTeamIds = new Set((assignmentsResult.data || []).map((row) => row.team_id));
  accessibleLeagues = isAdmin
    ? [...LEAGUES]
    : [...new Set((assignmentsResult.data || []).map((row) => row.league_code).filter(Boolean))];

  if (!state.league || !accessibleLeagues.includes(state.league)) {
    state.league = accessibleLeagues[0] || state.league || "Keystone";
  }
}

function renderLeagueTabs() {
  leagueTabsEl.innerHTML = LEAGUES.map((league) => {
    const allowed = accessibleLeagues.includes(league);
    const active = state.league === league;
    return `
      <a class="roster-league-tab ${active ? "is-active" : ""} ${allowed ? "" : "is-disabled"}"
        href="${allowed ? `/rosters.html?league=${encodeURIComponent(league)}` : "#"}"
        aria-disabled="${allowed ? "false" : "true"}">
        ${escapeHtml(league)}
      </a>
    `;
  }).join("");
}

function updateUrl() {
  const params = new URLSearchParams();
  params.set("league", state.league);
  if (state.date !== todayString()) params.set("date", state.date);
  if (state.range !== "day") params.set("range", state.range);
  window.history.replaceState(null, "", `/rosters.html?${params.toString()}`);
}

async function loadRosters() {
  const { data, error } = await supabase
    .from("public_team_rosters")
    .select("season_number,league_code,team_id,team_name,player_id,mlb_player_id,player_name,primary_position,eligible_positions,mlb_team_abbreviation,contract_years,acquired_on,acquisition_type")
    .eq("season_number", 32)
    .eq("league_code", state.league)
    .order("team_name", { ascending: true })
    .order("player_name", { ascending: true });

  if (error) throw error;
  rosterRows = data || [];
}

async function loadLineups() {
  const teamNames = [...new Set(rosterRows.map((row) => row.team_name).filter(Boolean))];
  const teamSlugs = [...new Set(teamNames.map(slugify).filter(Boolean))];
  lineupByTeamSlug = new Map();
  lineupDateByTeamSlug = new Map();
  if (teamSlugs.length) {
    const { data, error } = await supabase
      .from("team_daily_lineups")
      .select("team_slug,lineup,lineup_date")
      .in("team_slug", teamSlugs)
      .lte("lineup_date", state.date)
      .order("team_slug", { ascending: true })
      .order("lineup_date", { ascending: false });

    if (error) throw error;
    for (const row of data || []) {
      if (lineupByTeamSlug.has(row.team_slug)) continue;
      lineupByTeamSlug.set(row.team_slug, row.lineup || {});
      lineupDateByTeamSlug.set(row.team_slug, row.lineup_date);
    }
  }
  if (!teamNames.length) return;

  const { data: scoreRows, error: scoreError } = await supabase
    .from("game_player_daily_score_results")
    .select("id,team_name,player_name,roster_slot,stat_date")
    .eq("season_number", 32)
    .eq("stat_date", state.date)
    .in("team_name", teamNames)
    .order("team_name", { ascending: true })
    .order("id", { ascending: true });

  if (!scoreError) mergeLineupsFromScoreRows(scoreRows || []);
}

function mergeLineupsFromScoreRows(scoreRows) {
  const slotCountsByTeam = new Map();
  for (const row of scoreRows) {
    if (!row.team_name || !row.player_name || !row.roster_slot) continue;
    const teamSlug = slugify(row.team_name);
    const lineup = { ...(lineupByTeamSlug.get(teamSlug) || {}) };
    const counts = slotCountsByTeam.get(teamSlug) || { OF: 0, SP: 0, RP: 0 };
    const slot = scoreSlotToLineupSlot(row.roster_slot, counts);
    const canReplaceExisting = lineupDateByTeamSlug.get(teamSlug) !== state.date;
    if (!slot || (lineup[slot] && !canReplaceExisting)) {
      slotCountsByTeam.set(teamSlug, counts);
      continue;
    }
    lineup[slot] = slugify(row.player_name);
    lineupByTeamSlug.set(teamSlug, lineup);
    slotCountsByTeam.set(teamSlug, counts);
  }
}

function scoreSlotToLineupSlot(value, counts) {
  const slot = String(value || "").toUpperCase();
  if (slot === "DH") return "UTIL";
  if (slot === "OF") {
    counts.OF += 1;
    return `OF${Math.min(counts.OF, 3)}`;
  }
  if (slot === "SP") {
    counts.SP += 1;
    return `SP${Math.min(counts.SP, 4)}`;
  }
  if (slot === "RP") {
    counts.RP += 1;
    return `RP${Math.min(counts.RP, 2)}`;
  }
  return slotOrder[slot] ? slot : "";
}

async function loadActivePlayerLookup() {
  if (activePlayerLookup) return activePlayerLookup;
  const data = await fetchJson(`${API_ROOT}/sports/1/players?season=${SEASON}`);
  activePlayerLookup = new Map();
  for (const person of data.people || []) {
    if (!person.fullName) continue;
    const key = normalizeName(person.fullName);
    if (!activePlayerLookup.has(key) || person.active) {
      activePlayerLookup.set(key, person);
    }
  }
  return activePlayerLookup;
}

async function resolveMlbIds() {
  const cache = loadCachedPlayerIds();
  const lookup = await loadActivePlayerLookup();
  for (const row of rosterRows) {
    if (row.mlb_player_id) {
      cache[row.player_id] = row.mlb_player_id;
      continue;
    }
    if (cache[row.player_id]) continue;
    const match = lookup.get(normalizeName(row.player_name));
    if (match?.id) cache[row.player_id] = match.id;
  }
  saveCachedPlayerIds(cache);
  return cache;
}

function chunks(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function loadStats() {
  statsByPlayerId = new Map();
  peopleByPlayerId = new Map();
  gameByPlayerId = new Map();
  statusByPlayerId = new Map();
  const idCache = await resolveMlbIds();
  const rowsByMlbId = new Map();
  for (const row of rosterRows) {
    const mlbId = idCache[row.player_id];
    if (!mlbId) continue;
    if (!rowsByMlbId.has(mlbId)) rowsByMlbId.set(mlbId, []);
    rowsByMlbId.get(mlbId).push(row);
  }

  const hydrate = `currentTeam,stats(group=[hitting,pitching],type=[byDateRange],startDate=${rangeStart()},endDate=${state.date})`;
  for (const chunk of chunks([...rowsByMlbId.keys()], CHUNK_SIZE)) {
    const data = await fetchJson(`${API_ROOT}/people?personIds=${chunk.join(",")}&hydrate=${hydrate}`);
    for (const person of data.people || []) {
      for (const row of rowsByMlbId.get(person.id) || []) {
        statsByPlayerId.set(row.player_id, statsForPerson(row, person));
        peopleByPlayerId.set(row.player_id, person);
      }
    }
  }

  await loadRosterStatuses(idCache);
  if (state.range === "day") await loadScheduleContext(idCache);
}

async function loadRosterStatuses(idCache) {
  try {
    const teamsData = await fetchJson(`${API_ROOT}/teams?sportId=1&season=${SEASON}`);
    const teamByAbbr = new Map((teamsData.teams || []).map((team) => [teamAbbr(team), team.id]));
    const rosterTeamIds = [
      ...new Set(rosterRows
        .map((row) => teamByAbbr.get(normalizeMlbTeamAbbr(row.mlb_team_abbreviation)))
        .filter(Boolean))
    ];
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
    for (const row of rosterRows) {
      statusByPlayerId.set(row.player_id, normalizePlayerStatus(statusByMlbId.get(Number(idCache[row.player_id]))));
    }
  } catch {
    statusByPlayerId = new Map();
  }
}

async function loadScheduleContext(idCache) {
  try {
    const data = await fetchJson(`${API_ROOT}/schedule?sportId=1&date=${state.date}&hydrate=probablePitcher,team,linescore`);
    const games = data.dates?.[0]?.games || [];
    const rosterTeams = new Set(rosterRows.map((row) => normalizeMlbTeamAbbr(row.mlb_team_abbreviation)).filter(Boolean));
    const relevantGames = games.filter((game) => (
      rosterTeams.has(teamAbbr(game.teams.away.team)) || rosterTeams.has(teamAbbr(game.teams.home.team))
    ));
    const boxscores = await Promise.all(relevantGames.map(async (game) => {
      try {
        return { game, boxscore: await fetchJson(`${API_ROOT}/game/${game.gamePk}/boxscore`) };
      } catch {
        return { game, boxscore: null };
      }
    }));

    for (const row of rosterRows) {
      const rowTeam = normalizeMlbTeamAbbr(row.mlb_team_abbreviation);
      const gameBundle = boxscores.find(({ game }) => {
        const away = teamAbbr(game.teams.away.team);
        const home = teamAbbr(game.teams.home.team);
        return away === rowTeam || home === rowTeam;
      });
      gameByPlayerId.set(row.player_id, gameBundle
        ? playerGameContext(row, gameBundle.game, gameBundle.boxscore, Number(idCache[row.player_id]))
        : null);
    }
  } catch {
    gameByPlayerId = new Map();
  }
}

function normalizePlayerStatus(status) {
  if (!status) return "NA";
  const code = String(status.code || "").toUpperCase();
  const description = String(status.description || "");
  const lowerDescription = description.toLowerCase();
  if (code === "A" || lowerDescription === "active") return "";
  if (code === "DTD" || lowerDescription.includes("day-to-day")) return "DTD";
  if (lowerDescription.includes("injured") || /^D\d+/.test(code)) {
    const days = code.match(/\d+/)?.[0];
    return days ? `IL-${days}` : "IL";
  }
  if (["RM", "FA", "OUT"].includes(code) || lowerDescription.includes("reassigned")) return "NA";
  return code || description;
}

function teamAbbr(team) {
  return normalizeMlbTeamAbbr(team?.abbreviation || team?.fileCode || team?.name);
}

function playerGameContext(row, game, boxscore, mlbId) {
  const away = teamAbbr(game.teams.away.team);
  const home = teamAbbr(game.teams.home.team);
  const rowTeam = normalizeMlbTeamAbbr(row.mlb_team_abbreviation);
  const isHome = home === rowTeam;
  const side = isHome ? "home" : "away";
  const otherSide = isHome ? "away" : "home";
  const opponent = isHome ? away : home;
  const playerBox = boxscore?.teams?.[side]?.players?.[`ID${mlbId}`];
  const playerStats = playerBox?.stats?.[playerType(row) === "pitcher" ? "pitching" : "batting"] || {};
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
  const scheduledStarter = playerType(row) === "pitcher"
    && positionsFor(row).includes("SP")
    && probablePitcherId === mlbId;
  const lineupReleased = Boolean(boxscore?.teams?.[side]?.batters?.length || playerBox?.battingOrder);
  const lineupOut = playerType(row) === "hitter" && lineupReleased && !battingOrder;

  return {
    battingOrder,
    decisions: pitcherDecisions(playerStats),
    gameInProgress: gameStarted && !gameFinal,
    lineupOut,
    scheduledStarter,
    line: gameStarted
      ? `${result || liveScore || game.status?.detailedState || "In progress"} ${isHome ? "vs" : "@"} ${opponent}`
      : `${gameTime} ${isHome ? "vs" : "@"} ${opponent}`
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
  if (number(stats.saves)) decisions.push("SV");
  return decisions;
}

function statGroup(person, group) {
  return (person.stats || []).find((entry) => entry.group?.displayName === group)?.splits?.[0]?.stat || {};
}

function statsForPerson(row, person) {
  if (playerType(row) === "pitcher") {
    const stat = statGroup(person, "pitching");
    return {
      inningsPitchedPoints: inningsToNumber(stat.inningsPitched),
      wins: number(stat.wins),
      losses: number(stat.losses),
      completeGames: number(stat.completeGames),
      shutouts: number(stat.shutouts),
      saves: number(stat.saves),
      strikeOuts: number(stat.strikeOuts),
      holds: number(stat.holds),
      reliefAppearances: number(stat.gamesPlayed),
      qualityStarts: number(stat.qualityStarts),
      blownSaves: number(stat.blownSaves)
    };
  }

  const stat = statGroup(person, "hitting");
  const hits = number(stat.hits);
  const doubles = number(stat.doubles);
  const triples = number(stat.triples);
  const homers = number(stat.homeRuns);
  return {
    atBats: number(stat.atBats),
    hits,
    runs: number(stat.runs),
    singles: Math.max(0, hits - doubles - triples - homers),
    doubles,
    triples,
    homeRuns: homers,
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

function formatInnings(value) {
  const whole = Math.floor(value || 0);
  const outs = Math.round(((value || 0) - whole) * 3);
  return outs ? `${whole}.${outs}` : String(whole);
}

function scoreStats(row, stats) {
  const rules = playerType(row) === "pitcher" ? pitcherRules : hitterRules;
  return rules.reduce((total, [key, points]) => total + number(stats[key]) * points, 0);
}

function statCells(row) {
  const stats = statsByPlayerId.get(row.player_id) || {};
  const hitterValues = playerType(row) === "hitter"
    ? [
      number(stats.atBats) || number(stats.hits) ? `${number(stats.hits)}/${number(stats.atBats)}` : "",
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
      stats.groundIntoDoublePlay
    ]
    : Array(12).fill("");
  const pitcherValues = playerType(row) === "pitcher"
    ? [formatInnings(stats.inningsPitchedPoints), stats.wins, stats.losses, stats.saves, stats.strikeOuts]
    : Array(5).fill("");
  return [...hitterValues, ...pitcherValues].map((value) => `<td class="lineup-stat-col">${escapeHtml(formatStatValue(value))}</td>`).join("");
}

function statSummary(row) {
  const stats = statsByPlayerId.get(row.player_id) || {};
  if (!Object.keys(stats).length) return "";
  if (playerType(row) === "pitcher") {
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
    ["GIDP", stats.groundIntoDoublePlay]
  ]);
}

function compactStats(items) {
  return items
    .filter(([, value, alwaysShow]) => alwaysShow || Number(value) !== 0)
    .map(([label, value, labelOnly]) => labelOnly && Number(value) === 1 ? label : `${label} ${value}`)
    .join(" | ");
}

function formatStatValue(value) {
  if (value === "0/0") return "";
  return Number(value) === 0 ? "" : value;
}

function formatPoints(value) {
  const numberValue = Number(value || 0);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
}

function filteredRows() {
  const query = searchEl.value.trim().toLowerCase();
  const team = teamEl.value;
  return rosterRows.filter((row) => {
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
  const previousTeam = teamEl.value;
  const teams = [...new Set(rosterRows.map((row) => row.team_name).filter(Boolean))].sort();
  teamEl.innerHTML = `<option value="all">All Teams</option>${teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join("")}`;
  if (teams.includes(previousTeam)) teamEl.value = previousTeam;
}

function lineupForTeam(teamName) {
  const exact = lineupByTeamSlug.get(slugify(teamName));
  if (exact) return exact;
  const normalizedTeam = normalizeName(teamName);
  for (const [teamSlug, lineup] of lineupByTeamSlug.entries()) {
    if (normalizeName(teamSlug) === normalizedTeam) return lineup;
  }
  return {};
}

function lineupValueMatchesRow(value, row) {
  const assigned = String(value || "");
  const rowId = String(row.player_id);
  return assigned === rowId
    || slugify(assigned) === slugify(row.player_name)
    || normalizeName(assigned) === normalizeName(row.player_name);
}

function activeSlotFor(row) {
  const lineup = lineupForTeam(row.team_name);
  for (const [slot, value] of Object.entries(lineup)) {
    if (lineupValueMatchesRow(value, row)) return slot;
  }
  return "";
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

function currentTeamSlugs() {
  return new Set(rosterRows.map((row) => slugify(row.team_name)).filter(Boolean));
}

function scheduleLineupRefresh() {
  window.clearTimeout(lineupRefreshTimer);
  lineupRefreshTimer = window.setTimeout(async () => {
    try {
      await loadLineups();
      render();
    } catch {
      // Keep the existing roster view if a realtime refresh misses.
    }
  }, 200);
}

function subscribeToLineupChanges() {
  if (!supabase?.channel || lineupSubscription) return;
  lineupSubscription = supabase
    .channel("ownersclub-roster-lineups")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "team_daily_lineups"
    }, (payload) => {
      const row = payload.new || payload.old || {};
      if (!row.team_slug || !currentTeamSlugs().has(row.team_slug)) return;
      if (row.lineup_date && row.lineup_date > state.date) return;
      scheduleLineupRefresh();
    })
    .subscribe();
}

function render() {
  titleEl.textContent = `${state.league} Rosters`;
  subtitleEl.textContent = isAdmin
    ? "Commissioner read-only roster access."
    : "League roster access for team owners.";
  windowLabelEl.textContent = rangeLabel();
  renderLeagueTabs();
  renderFilters();

  const rows = filteredRows();
  const teamGroups = [...groupBy(rows, (row) => row.team_name).entries()]
    .sort(([teamA], [teamB]) => teamA.localeCompare(teamB));

  if (!accessibleLeagues.includes(state.league)) {
    gridEl.innerHTML = `<section class="lineup-card roster-empty">You do not have access to ${escapeHtml(state.league)} rosters.</section>`;
  } else if (!rosterRows.length) {
    gridEl.innerHTML = `<section class="lineup-card roster-empty">No ${escapeHtml(state.league)} roster import has been loaded yet.</section>`;
  } else if (!teamGroups.length) {
    gridEl.innerHTML = `<section class="lineup-card roster-empty">No roster rows match the current filters.</section>`;
  } else {
    gridEl.innerHTML = teamGroups.map(([teamName, teamRows]) => renderTeamCard(teamName, teamRows)).join("");
  }

  const teamCount = teamGroups.length;
  statusEl.textContent = rosterRows.length
    ? `Showing ${rows.length} players across ${teamCount} team${teamCount === 1 ? "" : "s"}.`
    : `Run the ${state.league} roster import SQL in Supabase to populate this page.`;
}

function renderTeamCard(teamName, teamRows) {
  const teamId = teamRows[0]?.team_id;
  const withSlots = teamRows.map((row) => ({ row, slot: activeSlotFor(row) }));
  const active = withSlots
    .filter((item) => item.slot)
    .sort((a, b) => (slotOrder[a.slot] || 999) - (slotOrder[b.slot] || 999));
  const bench = withSlots
    .filter((item) => !item.slot)
    .sort((a, b) => positionSort(a.row) - positionSort(b.row) || a.row.player_name.localeCompare(b.row.player_name));
  return `
    <article class="roster-lineup-card">
      <header class="roster-card-header">
        <div>
          <span>${escapeHtml(state.league)}</span>
          <a href="/teams/${slugify(teamName)}/">${escapeHtml(teamName)}</a>
        </div>
        <strong>${teamRows.length}</strong>
      </header>
      ${lineupTable("Lineup", active, teamId)}
      ${lineupTable("Bench", bench, teamId)}
    </article>
  `;
}

function lineupTable(label, items, teamId) {
  return `
    <section class="roster-lineup-section">
      <h3>${escapeHtml(label)}</h3>
      <div class="table-wrap lineup-table-wrap roster-lineup-table-wrap">
        <table class="lineup-table roster-lineup-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>Fan Pts</th>
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
              <th class="lineup-stat-col">IP</th>
              <th class="lineup-stat-col">W</th>
              <th class="lineup-stat-col">L</th>
              <th class="lineup-stat-col">SV</th>
              <th class="lineup-stat-col">K</th>
              <th>Contract</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? items.map((item) => rosterRow(item.row, item.slot || "BN", teamId)).join("") : `<tr><td colspan="21" class="roster-no-lineup">No players listed.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function rosterRow(row, slot, teamId) {
  const isOwnTeam = ownTeamIds.has(teamId);
  const stats = statsByPlayerId.get(row.player_id) || {};
  const points = scoreStats(row, stats);
  const game = gameByPlayerId.get(row.player_id);
  const isBench = slot === "BN";
  const activeLive = !isBench && Boolean(game?.gameInProgress);
  const gameLine = state.range === "day"
    ? game ? gameLineHtml(row, game) : `<span class="lineup-game-text">No game</span>`
    : "";
  return `
    <tr class="lineup-player-row ${isBench ? "is-bench" : "is-active"} ${activeLive ? "is-live" : ""}">
      <td class="lineup-pos-cell">${escapeHtml(slotLabel(slot))}</td>
      <td class="lineup-player-cell">
        <div class="roster-player-action-row">
          ${isOwnTeam ? `<span class="roster-trade-spacer"></span>` : `<button class="roster-trade-button" type="button" data-action="trade" data-player-id="${row.player_id}" aria-label="Start trade offer for ${escapeHtml(row.player_name)}">+</button>`}
          <button class="lineup-player-button roster-player-button" type="button" data-action="player" data-player-id="${row.player_id}">
            <span class="lineup-player-main">
              <span>
                <strong class="lineup-player-name">${escapeHtml(row.player_name)} ${playerMetaHtml(row)}</strong>
              </span>
              <span class="lineup-player-game">${gameLine}</span>
            </span>
            <span class="lineup-player-statline">${escapeHtml(statSummary(row))}</span>
          </button>
        </div>
      </td>
      <td class="lineup-fantasy-points">${formatPoints(points)}</td>
      ${statCells(row)}
      <td class="roster-contract-cell">${escapeHtml(row.contract_years || "X")}</td>
    </tr>
  `;
}

function playerStatusBadge(row) {
  const status = statusByPlayerId.get(row.player_id);
  return status ? `<span class="lineup-status-badge">${escapeHtml(status)}</span>` : "";
}

function playerMetaHtml(row) {
  return `<span class="lineup-player-meta">${escapeHtml(normalizeMlbTeamAbbr(row.mlb_team_abbreviation))} - ${escapeHtml(formatPositions(row))}</span>${playerStatusBadge(row)}`;
}

function gameLineHtml(row, game) {
  const starterBadge = game.scheduledStarter ? `<span class="lineup-starter-badge" aria-label="Scheduled starter">✓</span>` : "";
  const leadBadges = playerType(row) === "pitcher"
    ? `${starterBadge}${game.decisions.map((decision) => `<span class="lineup-decision-badge is-${decision.toLowerCase()}">${escapeHtml(decision)}</span>`).join("")}`
    : Number.isFinite(game.battingOrder)
      ? `<span class="lineup-order-badge">${game.battingOrder}</span>`
      : game.lineupOut ? `<span class="lineup-out-badge" aria-label="Not in lineup">X</span>` : "";
  return `${leadBadges}<span class="lineup-game-text">${escapeHtml(game.line)}</span>`;
}

async function openPlayerDialog(playerId) {
  const row = rosterRows.find((item) => String(item.player_id) === String(playerId));
  if (!row) return;
  playerDialogTitle.textContent = `${row.player_name} - Last 2 Months`;
  playerDialogBody.innerHTML = `
    <div class="lineup-dialog-tabs" role="tablist" aria-label="Player detail tabs">
      <button class="is-active" type="button" data-player-tab="stats">Stats</button>
      <button type="button" data-player-tab="news">News</button>
    </div>
    <section class="lineup-dialog-panel is-active" data-player-panel="stats">
      <p class="admin-note">Loading player stats...</p>
    </section>
    <section class="lineup-dialog-panel" data-player-panel="news">
      <div class="lineup-news-list" data-news-player-id="${row.player_id}">Loading news...</div>
    </section>
  `;
  playerDialog.showModal();
  await Promise.all([renderPlayerGameLog(row), renderPlayerNews(row)]);
}

async function mlbIdForRow(row) {
  const cache = await resolveMlbIds();
  return cache[row.player_id];
}

async function renderPlayerGameLog(row) {
  const panel = playerDialogBody.querySelector("[data-player-panel='stats']");
  if (!panel) return;
  const mlbId = await mlbIdForRow(row);
  if (!mlbId) {
    panel.innerHTML = `<p class="admin-note">No MLB player match found.</p>`;
    return;
  }
  try {
    const group = playerType(row) === "pitcher" ? "pitching" : "hitting";
    const data = await fetchJson(`${API_ROOT}/people/${mlbId}/stats?stats=gameLog&group=${group}&season=${SEASON}`);
    const splits = (data.stats?.[0]?.splits || [])
      .filter((split) => split.date >= lastTwoMonthsStart() && split.date <= state.date)
      .slice()
      .reverse();
    panel.innerHTML = `
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
          <tbody>${splits.map((split) => gameLogRow(row, split)).join("")}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    panel.innerHTML = `<p class="admin-note">Could not load player stats.</p>`;
  }
}

function gameLogRow(row, split) {
  const stats = normalizeSplitStats(row, split);
  const points = scoreStats(row, stats);
  return `
    <tr>
      <td>${escapeHtml(split.date)}</td>
      <td>${split.isHome ? "vs" : "@"} ${escapeHtml(split.opponent?.name || "")}</td>
      <td><span class="lineup-result-badge ${split.isWin ? "is-win" : "is-loss"}">${split.isWin ? "W" : "L"}</span></td>
      <td>${escapeHtml(split.stat?.summary || "")}</td>
      <td>${formatPoints(points)}</td>
    </tr>
  `;
}

function normalizeSplitStats(row, split) {
  const stat = split.stat || {};
  if (playerType(row) === "pitcher") {
    return {
      inningsPitchedPoints: inningsToNumber(stat.inningsPitched),
      wins: number(stat.wins),
      losses: number(stat.losses),
      completeGames: number(stat.completeGames),
      shutouts: number(stat.shutouts),
      saves: number(stat.saves),
      strikeOuts: number(stat.strikeOuts),
      holds: number(stat.holds),
      reliefAppearances: number(stat.gamesPlayed),
      qualityStarts: number(stat.qualityStarts),
      blownSaves: number(stat.blownSaves)
    };
  }
  const hits = number(stat.hits);
  const doubles = number(stat.doubles);
  const triples = number(stat.triples);
  const homers = number(stat.homeRuns);
  return {
    atBats: number(stat.atBats),
    hits,
    runs: number(stat.runs),
    singles: Math.max(0, hits - doubles - triples - homers),
    doubles,
    triples,
    homeRuns: homers,
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

async function loadNewsFeed() {
  if (newsArticles) return newsArticles;
  const data = await fetchJson(`${ESPN_NEWS_ROOT}?limit=100`);
  newsArticles = data.articles || [];
  return newsArticles;
}

async function renderPlayerNews(row) {
  const newsList = playerDialogBody.querySelector(`[data-news-player-id="${row.player_id}"]`);
  if (!newsList) return;
  try {
    const articles = await loadNewsFeed();
    const weekStart = new Date(`${addDays(state.date, -7)}T00:00:00`);
    const matches = articles.filter((article) => playerNewsMatch(row, article, weekStart)).slice(0, 6);
    newsList.innerHTML = matches.length ? matches.map(newsCard).join("") : "";
  } catch {
    newsList.innerHTML = "";
  }
}

function playerNewsMatch(row, article, weekStart) {
  const published = new Date(article.published || article.lastModified || 0);
  if (Number.isNaN(published.getTime()) || published < weekStart) return false;
  const name = String(row.player_name || "").toLowerCase();
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

async function reloadRosterView() {
  updateUrl();
  rangeEl.value = state.range;
  gridEl.innerHTML = "";
  statusEl.textContent = "Loading rosters...";
  await loadRosters();
  dateEl.value = state.date;
  await loadLineups();
  renderFilters();
  render();
  try {
    statusEl.textContent = "Loading MLB stats...";
    await loadStats();
  } catch {
    // Roster visibility should still work when the public MLB endpoint is unavailable.
  }
  render();
}

document.addEventListener("click", (event) => {
  const playerButton = event.target.closest("[data-action='player']");
  if (playerButton) {
    openPlayerDialog(playerButton.dataset.playerId);
    return;
  }

  const tradeButton = event.target.closest("[data-action='trade']");
  if (tradeButton) {
    const row = rosterRows.find((item) => String(item.player_id) === String(tradeButton.dataset.playerId));
    if (row) statusEl.textContent = `Trade offer setup next: ${row.player_name} from ${row.team_name}.`;
  }
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
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

searchEl.addEventListener("input", render);
teamEl.addEventListener("change", render);
dateEl.addEventListener("change", async () => {
  state.date = dateEl.value || todayString();
  await reloadRosterView();
});
prevDayEl.addEventListener("click", async () => {
  state.date = addDays(state.date, -1);
  await reloadRosterView();
});
nextDayEl.addEventListener("click", async () => {
  state.date = addDays(state.date, 1);
  await reloadRosterView();
});
rangeEl.addEventListener("change", async () => {
  state.range = rangeEl.value || "day";
  await reloadRosterView();
});

async function boot() {
  session = await requireSession();
  if (!session) return;
  supabase = await getSupabaseClient();
  await loadViewerAccess();
  if (!accessibleLeagues.length) {
    renderLeagueTabs();
    titleEl.textContent = "Rosters";
    statusEl.textContent = "Your account is not assigned to a team yet.";
    gridEl.innerHTML = `<section class="lineup-card roster-empty">Ask the commissioner to assign your account to a team.</section>`;
    return;
  }
  await reloadRosterView();
  subscribeToLineupChanges();
}

boot().catch((error) => {
  statusEl.textContent = `Could not load rosters: ${error.message}`;
  gridEl.innerHTML = "";
});
