const STORAGE_KEY = "ownersclub.highlandersLineupTest";

const hitters = [
  { id: "joe-mack", name: "Joe Mack", positions: ["C"] },
  { id: "michael-busch", name: "Michael Busch", positions: ["1B", "OF"] },
  { id: "cody-clemens", name: "Cody Clemens", positions: ["2B", "1B", "OF"] },
  { id: "zach-mckinstry", name: "Zach McKinstry", positions: ["3B", "2B", "SS", "OF"] },
  { id: "dansby-swanson", name: "Dansby Swanson", positions: ["SS"] },
  { id: "bryson-stott", name: "Bryson Stott", positions: ["2B", "SS"] },
  { id: "gavin-sheets", name: "Gavin Sheets", positions: ["OF", "1B"] },
  { id: "jung-hoo-lee", name: "Jung Hoo Lee", positions: ["OF"] },
  { id: "jake-mangum", name: "Jake Mangum", positions: ["OF"] },
  { id: "masyn-winn", name: "Masyn Winn", positions: ["SS"] },
  { id: "jose-caballero", name: "Jose Caballero", positions: ["2B", "3B", "SS", "OF"] },
  { id: "eugenio-suarez", name: "Eugenio Suarez", positions: ["3B"] },
  { id: "david-hamilton", name: "David Hamilton", positions: ["2B", "SS", "OF"] },
  { id: "trent-grisham", name: "Trent Grisham", positions: ["OF"] },
  { id: "sal-frelick", name: "Sal Frelick", positions: ["OF"] },
  { id: "austin-wells", name: "Austin Wells", positions: ["C"] },
  { id: "aaron-judge", name: "Aaron Judge", positions: ["OF"] },
  { id: "lenyn-sosa", name: "Lenyn Sosa", positions: ["2B", "3B"] },
  { id: "tyler-freeman", name: "Tyler Freeman", positions: ["2B", "OF"] }
];

const pitchers = [
  { id: "jesus-luzardo", name: "Jesus Luzardo", positions: ["SP"] },
  { id: "logan-webb", name: "Logan Webb", positions: ["SP"] },
  { id: "mackenzie-gore", name: "MacKenzie Gore", positions: ["SP"] },
  { id: "eduardo-rodriguez", name: "Eduardo Rodriguez", positions: ["SP"] },
  { id: "kyle-finnegan", name: "Kyle Finnegan", positions: ["RP"] },
  { id: "antonio-senzatela", name: "Antonio Senzatela", positions: ["SP", "RP"] },
  { id: "robert-suarez", name: "Robert Suarez", positions: ["RP"] },
  { id: "shane-baz", name: "Shane Baz", positions: ["SP"] },
  { id: "matthew-boyd", name: "Matthew Boyd", positions: ["SP"] },
  { id: "zack-littell", name: "Zack Littell", positions: ["SP"] },
  { id: "carlos-estevez", name: "Carlos Estevez", positions: ["RP"] },
  { id: "ryan-weathers", name: "Ryan Weathers", positions: ["SP"] }
];

const hitterSlots = [
  { code: "C", label: "C", allowed: ["C"] },
  { code: "1B", label: "1B", allowed: ["1B"] },
  { code: "2B", label: "2B", allowed: ["2B"] },
  { code: "SS", label: "SS", allowed: ["SS"] },
  { code: "3B", label: "3B", allowed: ["3B"] },
  { code: "OF1", label: "OF", allowed: ["OF"] },
  { code: "OF2", label: "OF", allowed: ["OF"] },
  { code: "OF3", label: "OF", allowed: ["OF"] },
  { code: "DH", label: "DH", allowed: ["C", "1B", "2B", "SS", "3B", "OF"] }
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
  ["R", "Runs", 1],
  ["1B", "Singles", 1],
  ["2B", "Doubles", 3],
  ["3B", "Triples", 4],
  ["HR", "Home Runs", 4],
  ["RBI", "RBI", 1],
  ["SB", "Stolen Bases", 2],
  ["CS", "Caught Stealing", -1],
  ["BB", "Walks", 1],
  ["HBP", "Hit By Pitch", 1],
  ["GIDP", "Ground Into Double Play", -2],
  ["CYC", "Cycle", 5],
  ["SLAM", "Grand Slam", 2]
];

const pitcherRules = [
  ["IP", "Innings Pitched", 1],
  ["W", "Wins", 4],
  ["L", "Losses", -2],
  ["CG", "Complete Games", 2],
  ["SHO", "Shutouts", 5],
  ["SV", "Saves", 5],
  ["K", "Strikeouts", 1],
  ["HLD", "Holds", 4],
  ["RAPP", "Relief Appearances", 1],
  ["NH", "No Hitters", 5],
  ["PG", "Perfect Games", 5],
  ["QS", "Quality Starts", 3],
  ["BSV", "Blown Saves", -1]
];

const defaultLineup = {
  C: "joe-mack",
  "1B": "michael-busch",
  "2B": "cody-clemens",
  SS: "bryson-stott",
  "3B": "zach-mckinstry",
  OF1: "gavin-sheets",
  OF2: "jung-hoo-lee",
  OF3: "jake-mangum",
  DH: "masyn-winn",
  SP1: "jesus-luzardo",
  SP2: "logan-webb",
  SP3: "mackenzie-gore",
  SP4: "eduardo-rodriguez",
  RP1: "kyle-finnegan",
  RP2: "antonio-senzatela"
};

const statusEl = document.querySelector("#lineup-status");
const lineupSlotsEl = document.querySelector("#lineup-slots");
const rosterListEl = document.querySelector("#roster-list");
const hitterRowsEl = document.querySelector("#hitter-stat-rows");
const pitcherRowsEl = document.querySelector("#pitcher-stat-rows");
const hittingTotalEl = document.querySelector("#hitting-total");
const pitchingTotalEl = document.querySelector("#pitching-total");
const teamTotalEl = document.querySelector("#team-total");
const scoringRulesEl = document.querySelector("#scoring-rules");
const saveButton = document.querySelector("#save-lineup-button");
const sampleButton = document.querySelector("#sample-stats-button");
const clearButton = document.querySelector("#clear-stats-button");

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.lineup && saved?.stats) return saved;
  } catch {
    // Use default below.
  }
  return { lineup: { ...defaultLineup }, stats: {} };
}

function allPlayers() {
  return [...hitters.map((player) => ({ ...player, group: "hitter" })), ...pitchers.map((player) => ({ ...player, group: "pitcher" }))];
}

function playerById(playerId) {
  return allPlayers().find((player) => player.id === playerId);
}

function optionsFor(slot) {
  const pool = slot.code.startsWith("SP") || slot.code.startsWith("RP") ? pitchers : hitters;
  return [
    `<option value="">Bench</option>`,
    ...pool.map((player) => {
      const eligible = slot.allowed.some((position) => player.positions.includes(position));
      const label = `${player.name} (${player.positions.join("/")})`;
      return `<option value="${player.id}" ${eligible ? "" : "data-ineligible=\"true\""}>${label}${eligible ? "" : " *"}</option>`;
    })
  ].join("");
}

function renderSlots() {
  const slots = [...hitterSlots, ...pitcherSlots];
  lineupSlotsEl.innerHTML = slots.map((slot) => `
    <label class="lineup-slot">
      <span>${slot.code}</span>
      <select data-slot="${slot.code}">
        ${optionsFor(slot)}
      </select>
    </label>
  `).join("");

  lineupSlotsEl.querySelectorAll("select").forEach((select) => {
    select.value = state.lineup[select.dataset.slot] || "";
  });
}

function renderRoster() {
  rosterListEl.innerHTML = allPlayers().map((player) => `
    <div class="roster-pill">
      <strong>${player.name}</strong>
      <span>${player.positions.join("/")}</span>
    </div>
  `).join("");
}

function statValue(playerId, key) {
  return Number(state.stats[playerId]?.[key] || 0);
}

function scorePlayer(playerId, rules) {
  return rules.reduce((total, [key, , points]) => total + statValue(playerId, key) * points, 0);
}

function rulesForPlayer(playerId) {
  return playerById(playerId)?.group === "pitcher" ? pitcherRules : hitterRules;
}

function activeRows(slots, rules) {
  return slots.map((slot) => {
    const player = playerById(state.lineup[slot.code]);
    if (!player) return "";
    const score = scorePlayer(player.id, rules);
    return `
      <div class="lineup-stat-row" data-player-id="${player.id}">
        <div class="lineup-stat-player">
          <strong>${slot.code} ${player.name}</strong>
          <span>${player.positions.join("/")}</span>
        </div>
        <div class="lineup-stat-inputs">
          ${rules.map(([key, label]) => `
            <label title="${label}">
              <span>${key}</span>
              <input data-stat="${key}" inputmode="decimal" type="number" step="0.1" value="${statValue(player.id, key)}">
            </label>
          `).join("")}
        </div>
        <strong class="lineup-player-score">${score}</strong>
      </div>
    `;
  }).join("");
}

function renderStats() {
  hitterRowsEl.innerHTML = activeRows(hitterSlots, hitterRules);
  pitcherRowsEl.innerHTML = activeRows(pitcherSlots, pitcherRules);
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

function renderRules() {
  scoringRulesEl.innerHTML = [
    ruleTable("Hitters", hitterRules),
    ruleTable("Pitchers", pitcherRules)
  ].join("");
}

function ruleTable(title, rules) {
  return `
    <div class="scoring-rule-card">
      <h3>${title}</h3>
      ${rules.map(([key, label, points]) => `
        <div>
          <span>${label} (${key})</span>
          <strong>${points}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function render() {
  renderSlots();
  renderRoster();
  renderStats();
  renderRules();
}

function saveState(message = "Lineup test saved.") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  statusEl.textContent = message;
}

function setSampleStats() {
  state.stats = {
    "joe-mack": { R: 1, "1B": 1, HR: 1, RBI: 2, BB: 1 },
    "michael-busch": { "2B": 1, RBI: 1 },
    "cody-clemens": { "1B": 1, RBI: 1 },
    "zach-mckinstry": { BB: 2, R: 1 },
    "bryson-stott": { R: 1, "1B": 2, SB: 1 },
    "gavin-sheets": { HR: 1, R: 1, RBI: 2 },
    "jung-hoo-lee": { "1B": 1, R: 1 },
    "jake-mangum": { "1B": 2, RBI: 1 },
    "masyn-winn": { "2B": 1, RBI: 1, CS: 1 },
    "logan-webb": { IP: 6, W: 1, K: 6, QS: 1 },
    "mackenzie-gore": { IP: 5, K: 7 },
    "jesus-luzardo": { IP: 6, K: 8, QS: 1 },
    "eduardo-rodriguez": { IP: 4.2, L: 1, K: 4 },
    "kyle-finnegan": { IP: 1, SV: 1, K: 1, RAPP: 1 },
    "antonio-senzatela": { IP: 1, HLD: 1, K: 2, RAPP: 1 }
  };
  renderStats();
  saveState("Sample stat line loaded.");
}

lineupSlotsEl.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-slot]");
  if (!select) return;
  state.lineup[select.dataset.slot] = select.value;
  renderStats();
});

document.addEventListener("input", (event) => {
  const input = event.target.closest(".lineup-stat-row input[data-stat]");
  if (!input) return;
  const row = input.closest(".lineup-stat-row");
  const playerId = row.dataset.playerId;
  state.stats[playerId] ||= {};
  state.stats[playerId][input.dataset.stat] = Number(input.value || 0);
  row.querySelector(".lineup-player-score").textContent = String(scorePlayer(playerId, rulesForPlayer(playerId)));
  updateTotals();
});

saveButton.addEventListener("click", () => saveState());
sampleButton.addEventListener("click", setSampleStats);
clearButton.addEventListener("click", () => {
  state.stats = {};
  renderStats();
  saveState("Stats cleared.");
});

render();
