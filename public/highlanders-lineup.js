const STORAGE_KEY = "ownersclub.highlandersLineupTest";
const SEASON_START = "2026-03-26";

const hitters = [
  { id: "joe-mack", name: "Joe Mack", positions: ["C"], mlb: "MIA", opp: "SEA" },
  { id: "michael-busch", name: "Michael Busch", positions: ["1B", "OF"], mlb: "CHC", opp: "@ BAL" },
  { id: "kody-clemens", name: "Kody Clemens", positions: ["2B", "1B", "OF"], mlb: "MIN", opp: "CLE" },
  { id: "zach-mckinstry", name: "Zach McKinstry", positions: ["3B", "2B", "SS", "OF"], mlb: "DET", opp: "ATH" },
  { id: "bryson-stott", name: "Bryson Stott", positions: ["2B", "SS"], mlb: "PHI", opp: "@ CIN" },
  { id: "gavin-sheets", name: "Gavin Sheets", positions: ["OF", "1B"], mlb: "SD", opp: "AZ" },
  { id: "jung-hoo-lee", name: "Jung Hoo Lee", positions: ["OF"], mlb: "SF", opp: "TOR" },
  { id: "jake-mangum", name: "Jake Mangum", positions: ["OF"], mlb: "PIT", opp: "ATL" },
  { id: "masyn-winn", name: "Masyn Winn", positions: ["SS"], mlb: "STL", opp: "MIL" },
  { id: "jose-caballero", name: "Jose Caballero", positions: ["2B", "3B", "SS", "OF"], mlb: "NYY", opp: "@ TB" },
  { id: "eugenio-suarez", name: "Eugenio Suarez", positions: ["3B"], mlb: "CIN", opp: "PHI" },
  { id: "david-hamilton", name: "David Hamilton", positions: ["2B", "SS", "OF"], mlb: "MIL", opp: "@ STL" },
  { id: "trent-grisham", name: "Trent Grisham", positions: ["OF"], mlb: "NYY", opp: "@ TB" },
  { id: "sal-frelick", name: "Sal Frelick", positions: ["OF"], mlb: "MIL", opp: "@ STL" },
  { id: "austin-wells", name: "Austin Wells", positions: ["C"], mlb: "NYY", opp: "@ TB" },
  { id: "aaron-judge", name: "Aaron Judge", positions: ["OF"], mlb: "NYY", opp: "@ TB" },
  { id: "lenyn-sosa", name: "Lenyn Sosa", positions: ["2B", "3B"], mlb: "TOR", opp: "@ SF" },
  { id: "tyler-freeman", name: "Tyler Freeman", positions: ["2B", "OF"], mlb: "COL", opp: "@ LAD" }
];

const pitchers = [
  { id: "jesus-luzardo", name: "Jesus Luzardo", positions: ["SP"], mlb: "PHI", opp: "@ CIN" },
  { id: "logan-webb", name: "Logan Webb", positions: ["SP"], mlb: "SF", opp: "TOR" },
  { id: "mackenzie-gore", name: "MacKenzie Gore", positions: ["SP"], mlb: "WSH", opp: "LAA" },
  { id: "eduardo-rodriguez", name: "Eduardo Rodriguez", positions: ["SP"], mlb: "AZ", opp: "@ SD" },
  { id: "kyle-finnegan", name: "Kyle Finnegan", positions: ["RP"], mlb: "DET", opp: "ATH" },
  { id: "antonio-senzatela", name: "Antonio Senzatela", positions: ["SP", "RP"], mlb: "COL", opp: "@ LAD" },
  { id: "robert-suarez", name: "Robert Suarez", positions: ["RP"], mlb: "ATL", opp: "@ PIT" },
  { id: "shane-baz", name: "Shane Baz", positions: ["SP"], mlb: "BAL", opp: "CHC" },
  { id: "matthew-boyd", name: "Matthew Boyd", positions: ["SP"], mlb: "CHC", opp: "@ BAL" },
  { id: "zack-littell", name: "Zack Littell", positions: ["SP"], mlb: "WSH", opp: "HOU" },
  { id: "carlos-estevez", name: "Carlos Estevez", positions: ["RP"], mlb: "KC", opp: "@ NYM" },
  { id: "ryan-sloan", name: "Ryan Sloan", positions: ["SP"], mlb: "SEA", opp: "@ MIA" }
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
  ["R", 1], ["1B", 1], ["2B", 3], ["3B", 4], ["HR", 4], ["RBI", 1], ["SB", 2],
  ["CS", -1], ["BB", 1], ["HBP", 1], ["GIDP", -2], ["CYC", 5], ["SLAM", 2]
];
const pitcherRules = [
  ["IP", 1], ["W", 4], ["L", -2], ["CG", 2], ["SHO", 5], ["SV", 5], ["K", 1],
  ["HLD", 4], ["RAPP", 1], ["NH", 5], ["PG", 5], ["QS", 3], ["BSV", -1]
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
const windowLabelEl = document.querySelector("#lineup-window-label");
const statusEl = document.querySelector("#lineup-status");
const hitterBodyEl = document.querySelector("#hitter-table-body");
const pitcherBodyEl = document.querySelector("#pitcher-table-body");
const hittingTotalEl = document.querySelector("#hitting-total");
const pitchingTotalEl = document.querySelector("#pitching-total");
const teamTotalEl = document.querySelector("#team-total");
const saveButton = document.querySelector("#save-lineup-button");
const sampleButton = document.querySelector("#sample-stats-button");
const resetButton = document.querySelector("#reset-lineup-button");
const clearButton = document.querySelector("#clear-stats-button");

let state = loadState();
dateEl.value = state.date;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.lineup && saved?.stats) {
      return {
        date: saved.date || todayString(),
        range: saved.range || "day",
        lineup: { ...defaultLineup, ...saved.lineup },
        stats: saved.stats
      };
    }
  } catch {
    // Fall through to default state.
  }
  return { date: todayString(), range: "day", lineup: { ...defaultLineup }, stats: {} };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeStart() {
  const offsets = { day: 0, week: -6, twoWeeks: -13, month: -29, threeMonths: -89 };
  if (state.range === "season") return SEASON_START;
  return addDays(state.date, offsets[state.range] || 0);
}

function rangeLabel() {
  const labels = {
    day: "1 day",
    week: "1 week",
    twoWeeks: "2 weeks",
    month: "1 month",
    threeMonths: "3 months",
    season: "full season"
  };
  return `${labels[state.range] || "1 day"}: ${rangeStart()} through ${state.date}`;
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

function statValue(playerId, key) {
  return Number(state.stats[playerId]?.[key] || 0);
}

function scorePlayer(playerId, rules) {
  return rules.reduce((total, [key, points]) => total + statValue(playerId, key) * points, 0);
}

function isEligible(player, slot) {
  return slot.allowed.some((position) => player.positions.includes(position));
}

function slotLabel(slot) {
  return slot.label || slot.code;
}

function playerSlot(playerId) {
  return Object.entries(state.lineup).find(([, assignedId]) => assignedId === playerId)?.[0] || "";
}

function rowsFor(pool, slots, rules) {
  const activeRows = slots.map((slot) => ({ slot, player: playerById(state.lineup[slot.code]) })).filter((row) => row.player);
  const activeIds = new Set(activeRows.map((row) => row.player.id));
  const benchRows = pool
    .filter((player) => !activeIds.has(player.id))
    .map((player) => ({ slot: { code: "BN", label: "BN", allowed: player.positions }, player }));
  return [...activeRows, ...benchRows].map(({ slot, player }) => tableRow(player, slot, rules)).join("");
}

function tableRow(player, slot, rules) {
  const fanPoints = scorePlayer(player.id, rules);
  const slotCode = slot.code;
  return `
    <tr class="lineup-player-row" draggable="true" data-player-id="${player.id}" data-current-slot="${slotCode}">
      <td class="lineup-pos-cell" data-slot="${slotCode}" data-group="${player.group}">
        <span class="lineup-pos-pill">${slotLabel(slot)}</span>
      </td>
      <td class="lineup-player-cell">
        <strong>${player.name}</strong>
        <span>${player.mlb} - ${player.positions.join(", ")}</span>
      </td>
      <td>${player.opp || "-"}</td>
      <td class="lineup-fantasy-points">${fanPoints}</td>
      ${rules.map(([key]) => `
        <td>
          <input data-stat="${key}" data-player-id="${player.id}" type="number" step="0.1" inputmode="decimal" value="${statValue(player.id, key)}">
        </td>
      `).join("")}
    </tr>
  `;
}

function renderTables() {
  hitterBodyEl.innerHTML = rowsFor(hitters, hitterSlots, hitterRules);
  pitcherBodyEl.innerHTML = rowsFor(pitchers, pitcherSlots, pitcherRules);
  updateWindow();
  updateTotals();
}

function activePlayerIds(slots) {
  return slots.map((slot) => state.lineup[slot.code]).filter(Boolean);
}

function updateTotals() {
  const hitting = activePlayerIds(hitterSlots).reduce((total, playerId) => total + scorePlayer(playerId, hitterRules), 0);
  const pitching = activePlayerIds(pitcherSlots).reduce((total, playerId) => total + scorePlayer(playerId, pitcherRules), 0);
  hittingTotalEl.textContent = String(hitting);
  pitchingTotalEl.textContent = String(pitching);
  teamTotalEl.textContent = String(hitting + pitching);
}

function updateWindow() {
  windowLabelEl.textContent = rangeLabel();
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.range === state.range);
  });
}

function saveState(message = "Lineup test saved.") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  statusEl.textContent = message;
}

function assignPlayer(playerId, targetSlotCode) {
  const player = playerById(playerId);
  const allSlots = [...hitterSlots, ...pitcherSlots];
  const targetSlot = allSlots.find((slot) => slot.code === targetSlotCode);
  if (!player || !targetSlot) return;
  if (!isEligible(player, targetSlot)) {
    statusEl.textContent = `${player.name} is not eligible at ${slotLabel(targetSlot)}.`;
    return;
  }

  const oldSlotCode = playerSlot(playerId);
  const replacedPlayerId = state.lineup[targetSlotCode];
  if (oldSlotCode) {
    state.lineup[oldSlotCode] = replacedPlayerId || "";
  }
  state.lineup[targetSlotCode] = playerId;
  renderTables();
  saveState(`${player.name} moved to ${slotLabel(targetSlot)}.`);
}

function loadSampleStats() {
  state.stats = {
    "joe-mack": { R: 1, "1B": 1, HR: 1, RBI: 2, BB: 1 },
    "michael-busch": { "2B": 1, RBI: 1 },
    "kody-clemens": { "1B": 1, RBI: 1 },
    "zach-mckinstry": { BB: 2, R: 1 },
    "bryson-stott": { R: 1, "1B": 2, SB: 1 },
    "gavin-sheets": { HR: 1, R: 1, RBI: 2 },
    "jung-hoo-lee": { "1B": 1, R: 1 },
    "jake-mangum": { "1B": 2, RBI: 1 },
    "masyn-winn": { "2B": 1, RBI: 1, CS: 1 },
    "logan-webb": { IP: 6, W: 1, K: 6 },
    "mackenzie-gore": { IP: 5, K: 7 },
    "jesus-luzardo": { IP: 6, K: 8 },
    "eduardo-rodriguez": { IP: 4.2, L: 1, K: 4 },
    "kyle-finnegan": { IP: 1, SV: 1, K: 1, RAPP: 1 },
    "antonio-senzatela": { IP: 1, HLD: 1, K: 2, RAPP: 1 }
  };
  renderTables();
  saveState("Sample stat line loaded.");
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

document.addEventListener("input", (event) => {
  const input = event.target.closest(".lineup-table input[data-stat]");
  if (!input) return;
  const playerId = input.dataset.playerId;
  state.stats[playerId] ||= {};
  state.stats[playerId][input.dataset.stat] = Number(input.value || 0);
  const player = playerById(playerId);
  const rules = player.group === "pitcher" ? pitcherRules : hitterRules;
  input.closest("tr").querySelector(".lineup-fantasy-points").textContent = String(scorePlayer(playerId, rules));
  updateTotals();
});

dateEl.addEventListener("change", () => {
  state.date = dateEl.value || todayString();
  updateWindow();
  saveState("Date window updated.");
});

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => {
    state.range = button.dataset.range;
    updateWindow();
    saveState("Stat range updated.");
  });
});

saveButton.addEventListener("click", () => saveState());
sampleButton.addEventListener("click", loadSampleStats);
resetButton.addEventListener("click", () => {
  state.lineup = { ...defaultLineup };
  renderTables();
  saveState("Lineup reset.");
});
clearButton.addEventListener("click", () => {
  state.stats = {};
  renderTables();
  saveState("Stats cleared.");
});

renderTables();
