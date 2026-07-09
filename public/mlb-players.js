const API_ROOT = "https://statsapi.mlb.com/api/v1";
const SEASON = "2026";
const CHUNK_SIZE = 80;

const searchEl = document.querySelector("#players-search");
const typeEl = document.querySelector("#players-type");
const teamEl = document.querySelector("#players-team");
const statusEl = document.querySelector("#players-status");
const bodyEl = document.querySelector("#players-body");

let players = [];

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

function formatStat(value) {
  return Number(value) === 0 ? "" : value;
}

function playerType(player) {
  return player.primaryPosition?.abbreviation === "P" ? "pitcher" : "hitter";
}

function teamAbbrev(player) {
  return player.currentTeam?.abbreviation || player.currentTeam?.name || "";
}

function statGroup(player, group) {
  return (player.stats || []).find((entry) => entry.group?.displayName === group)?.splits?.[0]?.stat || {};
}

function hitterValues(player) {
  const stat = statGroup(player, "hitting");
  const hits = number(stat.hits);
  const doubles = number(stat.doubles);
  const triples = number(stat.triples);
  const homers = number(stat.homeRuns);
  return [
    hits || number(stat.atBats) ? `${hits}/${number(stat.atBats)}` : "",
    stat.runs,
    Math.max(0, hits - doubles - triples - homers),
    doubles,
    triples,
    homers,
    stat.rbi,
    stat.stolenBases,
    stat.caughtStealing,
    stat.baseOnBalls,
    stat.hitByPitch,
    stat.groundIntoDoublePlay
  ];
}

function pitcherValues(player) {
  const stat = statGroup(player, "pitching");
  return [stat.inningsPitched, stat.wins, stat.losses, stat.saves, stat.strikeOuts];
}

function tableRow(player) {
  const type = playerType(player);
  const hitterStats = type === "hitter" ? hitterValues(player) : Array(12).fill("");
  const pitcherStats = type === "pitcher" ? pitcherValues(player) : Array(5).fill("");
  return `
    <tr>
      <td><strong>${escapeHtml(player.fullName)}</strong></td>
      <td>${escapeHtml(teamAbbrev(player))}</td>
      <td>${escapeHtml(player.primaryPosition?.abbreviation || "")}</td>
      ${[...hitterStats, ...pitcherStats].map((value) => `<td class="lineup-stat-col">${escapeHtml(formatStat(value))}</td>`).join("")}
    </tr>
  `;
}

function filteredPlayers() {
  const query = searchEl.value.trim().toLowerCase();
  const type = typeEl.value;
  const team = teamEl.value;
  return players.filter((player) => {
    if (query && !player.fullName.toLowerCase().includes(query)) return false;
    if (type !== "all" && playerType(player) !== type) return false;
    if (team !== "all" && teamAbbrev(player) !== team) return false;
    return true;
  });
}

function render() {
  const visible = filteredPlayers().slice(0, 500);
  bodyEl.innerHTML = visible.map(tableRow).join("");
  statusEl.textContent = `Showing ${visible.length} of ${players.length} active MLB players.`;
}

function fillTeams() {
  const teams = [...new Set(players.map(teamAbbrev).filter(Boolean))].sort();
  teamEl.innerHTML = `<option value="all">All Teams</option>${teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join("")}`;
}

function chunks(values, size) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function hydratePlayers(basePlayers) {
  const ids = basePlayers.map((player) => player.id);
  const hydrated = [];
  for (const chunk of chunks(ids, CHUNK_SIZE)) {
    const url = `${API_ROOT}/people?personIds=${chunk.join(",")}&hydrate=currentTeam,stats(group=[hitting,pitching],type=[season],season=${SEASON})`;
    const data = await fetchJson(url);
    hydrated.push(...(data.people || []));
    statusEl.textContent = `Loaded stats for ${hydrated.length} of ${ids.length} players...`;
  }
  return hydrated;
}

async function loadPlayers() {
  try {
    const data = await fetchJson(`${API_ROOT}/sports/1/players?season=${SEASON}`);
    const activePlayers = (data.people || []).filter((player) => player.active);
    statusEl.textContent = `Found ${activePlayers.length} active players. Loading current stats...`;
    players = (await hydratePlayers(activePlayers)).sort((a, b) => a.fullName.localeCompare(b.fullName));
    fillTeams();
    render();
  } catch (error) {
    statusEl.textContent = `Could not load MLB player data: ${error.message}`;
    bodyEl.innerHTML = "";
  }
}

[searchEl, typeEl, teamEl].forEach((element) => element.addEventListener("input", render));
teamEl.addEventListener("change", render);
typeEl.addEventListener("change", render);

loadPlayers();
