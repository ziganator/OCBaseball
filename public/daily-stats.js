const API_ROOT = "https://statsapi.mlb.com/api/v1";

const dateLabelEl = document.querySelector("#stats-date-label");
const statusEl = document.querySelector("#stats-status");
const gamesCountEl = document.querySelector("#games-count");
const battersCountEl = document.querySelector("#batters-count");
const pitchersCountEl = document.querySelector("#pitchers-count");
const battingRowsEl = document.querySelector("#batting-rows");
const pitchingRowsEl = document.querySelector("#pitching-rows");

function yesterdayDateString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statDate() {
  const params = new URLSearchParams(window.location.search);
  return params.get("date") || yesterdayDateString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MLB API returned ${response.status} for ${url}`);
  }
  return response.json();
}

function value(stats, key) {
  const item = stats?.[key];
  return item === undefined || item === null || item === "" ? 0 : item;
}

function playerRowsFromTeam({ game, teamSide, opponentSide, statType }) {
  const team = game.boxscore.teams[teamSide];
  const opponent = game.boxscore.teams[opponentSide];
  return Object.values(team.players)
    .map((player) => ({
      gamePk: game.gamePk,
      playerId: player.person.id,
      player: player.person.fullName,
      team: team.team.abbreviation || team.team.name,
      opponent: opponent.team.abbreviation || opponent.team.name,
      stats: player.stats?.[statType] || {}
    }))
    .filter((row) => Object.keys(row.stats).length > 0 && value(row.stats, "gamesPlayed") > 0);
}

function flattenGames(games) {
  const batting = [];
  const pitching = [];

  for (const game of games) {
    batting.push(
      ...playerRowsFromTeam({ game, teamSide: "away", opponentSide: "home", statType: "batting" }),
      ...playerRowsFromTeam({ game, teamSide: "home", opponentSide: "away", statType: "batting" })
    );
    pitching.push(
      ...playerRowsFromTeam({ game, teamSide: "away", opponentSide: "home", statType: "pitching" }),
      ...playerRowsFromTeam({ game, teamSide: "home", opponentSide: "away", statType: "pitching" })
    );
  }

  batting.sort((a, b) => a.player.localeCompare(b.player));
  pitching.sort((a, b) => a.player.localeCompare(b.player));
  return { batting, pitching };
}

function cell(text) {
  return `<td>${text}</td>`;
}

function renderBattingRow(row) {
  const stats = row.stats;
  return `
    <tr>
      <td>${row.player}</td>
      <td>${row.team}</td>
      <td>${row.opponent}</td>
      ${cell(value(stats, "atBats"))}
      ${cell(value(stats, "runs"))}
      ${cell(value(stats, "hits"))}
      ${cell(value(stats, "doubles"))}
      ${cell(value(stats, "triples"))}
      ${cell(value(stats, "homeRuns"))}
      ${cell(value(stats, "rbi"))}
      ${cell(value(stats, "baseOnBalls"))}
      ${cell(value(stats, "hitByPitch"))}
      ${cell(value(stats, "stolenBases"))}
      ${cell(value(stats, "caughtStealing"))}
      ${cell(value(stats, "strikeOuts"))}
      ${cell(value(stats, "totalBases"))}
      ${cell(value(stats, "plateAppearances"))}
      <td>${stats.summary || ""}</td>
    </tr>
  `;
}

function renderPitchingRow(row) {
  const stats = row.stats;
  return `
    <tr>
      <td>${row.player}</td>
      <td>${row.team}</td>
      <td>${row.opponent}</td>
      <td>${stats.inningsPitched || "0.0"}</td>
      ${cell(value(stats, "hits"))}
      ${cell(value(stats, "runs"))}
      ${cell(value(stats, "earnedRuns"))}
      ${cell(value(stats, "baseOnBalls"))}
      ${cell(value(stats, "strikeOuts"))}
      ${cell(value(stats, "homeRuns"))}
      ${cell(value(stats, "numberOfPitches"))}
      ${cell(value(stats, "strikes"))}
      ${cell(value(stats, "wins"))}
      ${cell(value(stats, "losses"))}
      ${cell(value(stats, "saves"))}
      ${cell(value(stats, "holds"))}
      <td>${stats.summary || ""}</td>
    </tr>
  `;
}

async function loadDailyStats() {
  const date = statDate();
  dateLabelEl.textContent = date;
  statusEl.textContent = `Loading MLB player stats for ${date}...`;

  const schedule = await fetchJson(`${API_ROOT}/schedule?sportId=1&date=${date}`);
  const scheduledGames = schedule.dates?.[0]?.games || [];
  const finalGames = scheduledGames.filter((game) => game.status?.abstractGameState === "Final");

  if (!finalGames.length) {
    statusEl.textContent = `No final MLB games found for ${date}.`;
    gamesCountEl.textContent = "0";
    return;
  }

  const games = await Promise.all(finalGames.map(async (game) => ({
    gamePk: game.gamePk,
    boxscore: await fetchJson(`${API_ROOT}/game/${game.gamePk}/boxscore`)
  })));

  const { batting, pitching } = flattenGames(games);
  gamesCountEl.textContent = String(games.length);
  battersCountEl.textContent = String(batting.length);
  pitchersCountEl.textContent = String(pitching.length);
  battingRowsEl.innerHTML = batting.map(renderBattingRow).join("");
  pitchingRowsEl.innerHTML = pitching.map(renderPitchingRow).join("");
  statusEl.textContent = "";
}

loadDailyStats().catch((error) => {
  statusEl.textContent = `Could not load player stats: ${error.message}`;
});
