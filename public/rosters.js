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
let statsByPlayerId = new Map();
let peopleByPlayerId = new Map();
let newsArticles = null;
let activePlayerLookup = null;
let ownTeamIds = new Set();
let accessibleLeagues = [];
let isAdmin = false;
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
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  const { data, error } = await supabase
    .from("team_daily_lineups")
    .select("team_slug,lineup,lineup_date")
    .eq("lineup_date", state.date);

  if (error) throw error;
  lineupByTeamSlug = new Map((data || []).map((row) => [row.team_slug, row.lineup || {}]));
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

function activeSlotFor(row) {
  const lineup = lineupByTeamSlug.get(slugify(row.team_name)) || {};
  const rowSlug = slugify(row.player_name);
  const rowId = String(row.player_id);
  for (const [slot, value] of Object.entries(lineup)) {
    const assigned = String(value || "");
    if (assigned === rowId || assigned === rowSlug) return slot;
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
              <th>Contract</th>
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
              <th>Fan Pts</th>
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
  return `
    <tr class="lineup-player-row ${slot === "BN" ? "is-bench" : "is-active"}">
      <td class="lineup-pos-cell">${escapeHtml(slotLabel(slot))}</td>
      <td class="lineup-player-cell">
        <div class="roster-player-action-row">
          ${isOwnTeam ? `<span class="roster-trade-spacer"></span>` : `<button class="roster-trade-button" type="button" data-action="trade" data-player-id="${row.player_id}" aria-label="Start trade offer for ${escapeHtml(row.player_name)}">+</button>`}
          <button class="lineup-player-button roster-player-button" type="button" data-action="player" data-player-id="${row.player_id}">
            <span class="lineup-player-main">
              <span>
                <strong class="lineup-player-name">${escapeHtml(row.player_name)} <span class="lineup-player-meta">${escapeHtml(row.mlb_team_abbreviation || "")} - ${escapeHtml(formatPositions(row))}</span></strong>
              </span>
            </span>
          </button>
        </div>
      </td>
      <td class="roster-contract-cell">${escapeHtml(row.contract_years || "X")}</td>
      ${statCells(row)}
      <td class="lineup-fantasy-points">${formatPoints(points)}</td>
    </tr>
  `;
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
  dateEl.value = state.date;
  rangeEl.value = state.range;
  gridEl.innerHTML = "";
  statusEl.textContent = "Loading rosters...";
  await Promise.all([loadRosters(), loadLineups()]);
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
}

boot().catch((error) => {
  statusEl.textContent = `Could not load rosters: ${error.message}`;
  gridEl.innerHTML = "";
});
