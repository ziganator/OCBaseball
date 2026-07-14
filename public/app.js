import {
  displayTeam,
  teams as seedTeams,
  teamUrl
} from "./team-data.js?v=20260714b";

const SEASON = 32;
const WEEK_COUNT = 18;
const LEAGUE_ORDER = ["Keystone", "Diamond"];
const CONFERENCE_ORDER = ["Red", "Black"];
const DIVISION_ORDER = {
  Keystone: {
    Red: ["Seilhan", "Cox"],
    Black: ["Carranza", "Reasbeck"]
  },
  Diamond: {
    Red: ["Seilhan", "Cox"],
    Black: ["Carranza", "Reasbeck"]
  }
};

const statusEl = document.querySelector("#status");
const standingsEl = document.querySelector("#standings");
const teams = seedTeams.map(displayTeam);
const teamsByName = new Map(teams.map((team) => [normalizeTeam(team.name), team]));
const teamAliases = new Map([
  ["SAN ANTONIO OCOTILLOS", "SAN ANTONIO OCATILLOS"]
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTeam(value) {
  return String(value || "").trim().toUpperCase();
}

function numberValue(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function pctValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toFixed(3).replace(/^0/, "");
}

function percentToAverage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function initStanding(team) {
  return {
    team,
    key: normalizeTeam(team.name),
    wins: 0,
    losses: 0,
    divisionWins: 0,
    divisionLosses: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    offense: 0,
    pitching: 0,
    games: 0,
    outcomes: [],
    headToHead: new Map()
  };
}

function opponentMeta(name) {
  return teamsByName.get(teamKey(name));
}

function teamKey(name) {
  const key = normalizeTeam(name);
  return teamAliases.get(key) || key;
}

function recordGame(row, matchup, teamName, opponentName, didWin) {
  const team = row.team;
  const opponent = opponentMeta(opponentName);
  const opponentKey = teamKey(opponentName);
  if (didWin) row.wins += 1;
  else row.losses += 1;

  if (opponent?.division === team.division && opponent?.conference === team.conference && opponent?.league === team.league) {
    if (didWin) row.divisionWins += 1;
    else row.divisionLosses += 1;
  }

  if (opponent?.conference === team.conference && opponent?.league === team.league) {
    if (didWin) row.conferenceWins += 1;
    else row.conferenceLosses += 1;
  }

  row.pointsFor += Number(matchup[teamName === matchup.away_team_name ? "away_score" : "home_score"] || 0);
  row.pointsAgainst += Number(matchup[teamName === matchup.away_team_name ? "home_score" : "away_score"] || 0);
  row.games += 1;
  row.outcomes.push({ week: Number(matchup.week_number || 0), result: didWin ? "W" : "L" });

  if (!row.headToHead.has(opponentKey)) {
    row.headToHead.set(opponentKey, { wins: 0, losses: 0 });
  }
  const headToHead = row.headToHead.get(opponentKey);
  if (didWin) headToHead.wins += 1;
  else headToHead.losses += 1;
}

function addTeamDaily(row, teamRows) {
  for (const teamRow of teamRows) {
    row.offense += Number(teamRow.offense_points || 0);
    row.pitching += Number(teamRow.pitching_points || 0);
  }
}

function sortStandings(rows) {
  return rows.sort(compareStandingsRows);
}

function recordPct(wins, losses) {
  const total = Number(wins || 0) + Number(losses || 0);
  return total ? Number(wins || 0) / total : 0;
}

function headToHeadPct(row, opponent) {
  const record = row.headToHead.get(opponent.key);
  if (!record) return null;
  return recordPct(record.wins, record.losses);
}

function compareNumberDesc(a, b) {
  if (a === b) return 0;
  return b - a;
}

function compareStandingsRows(a, b) {
  const checks = [
    compareNumberDesc(a.winPct, b.winPct),
    compareNullableHeadToHead(a, b),
    compareNumberDesc(recordPct(a.divisionWins, a.divisionLosses), recordPct(b.divisionWins, b.divisionLosses)),
    compareNumberDesc(recordPct(a.conferenceWins, a.conferenceLosses), recordPct(b.conferenceWins, b.conferenceLosses)),
    compareNumberDesc(a.averagePerWeek, b.averagePerWeek),
    compareNumberDesc(a.averagePitchingPerWeek, b.averagePitchingPerWeek)
  ];
  return checks.find(Boolean) || a.team.name.localeCompare(b.team.name);
}

function compareNullableHeadToHead(a, b) {
  const aPct = headToHeadPct(a, b);
  const bPct = headToHeadPct(b, a);
  if (aPct === null || bPct === null || aPct === bPct) return 0;
  return compareNumberDesc(aPct, bPct);
}

function finalizeStandings(map) {
  const rows = Array.from(map.values()).map((row) => {
    const games = row.games || 0;
    const totalPoints = row.offense + row.pitching;
    return {
      ...row,
      totalPoints,
      winPct: games ? row.wins / games : 0,
      averagePerWeek: games ? row.pointsFor / games : 0,
      averagePitchingPerWeek: games ? row.pitching / games : 0,
      plusMinus: row.pointsFor - row.pointsAgainst,
      streak: streak(row.outcomes)
    };
  });

  for (const league of LEAGUE_ORDER) {
    for (const conference of CONFERENCE_ORDER) {
      const conferenceRows = sortStandings(rows.filter((row) => (
        row.team.league === league && row.team.conference === conference
      )));
      const conferenceAverage = conferenceRows.length
        ? conferenceRows.reduce((sum, row) => sum + row.averagePerWeek, 0) / conferenceRows.length
        : 0;
      conferenceRows.forEach((row, index) => {
        row.toAverage = conferenceAverage ? ((row.averagePerWeek - conferenceAverage) / conferenceAverage) * 100 : 0;
      });
      applyDivisionRanks(league, conference, rows);
      applyConferenceRanks(league, conference, rows);
    }
  }

  return rows;
}

function divisionRows(league, conference, division, rows) {
  return sortStandings(rows.filter((row) => (
    row.team.league === league &&
    row.team.conference === conference &&
    row.team.division === division
  )));
}

function applyDivisionRanks(league, conference, rows) {
  const divisions = DIVISION_ORDER[league]?.[conference] || [];
  for (const division of divisions) {
    divisionRows(league, conference, division, rows).forEach((row, index) => {
      row.divisionRank = index + 1;
    });
  }
}

function applyConferenceRanks(league, conference, rows) {
  const conferenceRows = rows.filter((row) => row.team.league === league && row.team.conference === conference);
  const divisions = DIVISION_ORDER[league]?.[conference] || [...new Set(conferenceRows.map((row) => row.team.division))];
  const divisionLeaders = sortStandings(divisions.map((division) => (
    divisionRows(league, conference, division, rows)[0]
  )).filter(Boolean));
  const leaderKeys = new Set(divisionLeaders.map((row) => row.key));
  const remaining = sortStandings(conferenceRows.filter((row) => !leaderKeys.has(row.key)));
  const ranked = [...divisionLeaders, ...remaining];

  ranked.forEach((row, index) => {
    row.conferenceRank = index + 1;
    row.postseasonSeed = "";
  });

  ranked.slice(0, 5).forEach((row, index) => {
    row.postseasonSeed = index + 1;
  });

  const wildCard = [...ranked.slice(5)].sort((a, b) => (
    compareNumberDesc(a.averagePerWeek, b.averagePerWeek) ||
    compareStandingsRows(a, b)
  ))[0];
  if (wildCard) wildCard.postseasonSeed = 6;
}

function streak(outcomes) {
  const ordered = [...outcomes].sort((a, b) => a.week - b.week);
  const last = ordered.at(-1);
  if (!last) return "-";
  let count = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (ordered[index].result !== last.result) break;
    count += 1;
  }
  return `${last.result} ${count}`;
}

async function fetchWeek(week) {
  const response = await fetch(`/api/game-results?season=${SEASON}&week=${week}&game=${week}`);
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.data || null;
}

async function loadSeasonResults() {
  const weeks = await Promise.all(
    Array.from({ length: WEEK_COUNT }, (_, index) => fetchWeek(index + 1).catch(() => null))
  );
  return weeks.filter((week) => week?.matchups?.length);
}

function buildStandings(weeks) {
  const map = new Map(teams.map((team) => [normalizeTeam(team.name), initStanding(team)]));

  for (const week of weeks) {
    for (const matchup of week.matchups || []) {
      const awayKey = teamKey(matchup.away_team_name);
      const homeKey = teamKey(matchup.home_team_name);
      const away = map.get(awayKey);
      const home = map.get(homeKey);
      if (!away || !home) continue;

      const awayScore = Number(matchup.away_score || 0);
      const homeScore = Number(matchup.home_score || 0);
      recordGame(away, matchup, matchup.away_team_name, matchup.home_team_name, awayScore > homeScore);
      recordGame(home, matchup, matchup.home_team_name, matchup.away_team_name, homeScore > awayScore);
    }

    const teamRowsByName = new Map();
    for (const teamRow of week.teams || []) {
      const key = teamKey(teamRow.team_name);
      if (!teamRowsByName.has(key)) teamRowsByName.set(key, []);
      teamRowsByName.get(key).push(teamRow);
    }
    for (const [key, rows] of teamRowsByName.entries()) {
      const standing = map.get(key);
      if (standing) addTeamDaily(standing, rows);
    }
  }

  return finalizeStandings(map);
}

function renderStandings(rows, loadedWeeks) {
  standingsEl.innerHTML = LEAGUE_ORDER.map((league) => leagueBoard(league, rows)).join("");
  wireStandingsLinks();
  statusEl.textContent = loadedWeeks ? "" : "No loaded game results yet.";
}

function leagueBoard(league, rows) {
  const leagueRows = rows.filter((row) => row.team.league === league);
  return `
    <section class="season-standings-board is-${league.toLowerCase()}">
      <div class="league-rail"><span>${escapeHtml(league)} League</span></div>
      <div class="league-board-content">
        ${CONFERENCE_ORDER.map((conference) => conferenceBoard(league, conference, leagueRows)).join("")}
      </div>
    </section>
  `;
}

function conferenceBoard(league, conference, rows) {
  const conferenceRows = rows.filter((row) => row.team.conference === conference);
  const divisions = DIVISION_ORDER[league]?.[conference] || [...new Set(conferenceRows.map((row) => row.team.division))];
  return `
    <section class="season-conference-block">
      <h2>${escapeHtml(conference)} Conference</h2>
      ${divisions.map((division) => divisionTable(division, conferenceRows.filter((row) => row.team.division === division))).join("")}
    </section>
  `;
}

function divisionTable(division, rows) {
  const sorted = [...rows].sort((a, b) => (a.divisionRank || 99) - (b.divisionRank || 99));
  return `
    <section class="season-division-row">
      <div class="season-division-title">${escapeHtml(division)} Division</div>
      <table class="season-standings-table">
        <thead>
          <tr>
            <th class="team-col">Team</th>
            <th>W</th>
            <th>L</th>
            <th>Win %</th>
            <th>Rank</th>
            <th>Avg/Week</th>
            <th colspan="2">Division</th>
            <th colspan="2">Conference</th>
            <th>Streak</th>
            <th>+/-</th>
            <th>% To Ave</th>
            <th>Offense</th>
            <th>Pitching</th>
            <th>Total Pts</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(standingsRow).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function standingsRow(row) {
  const fallbackLogo = row.team.capImage || row.team.listBanner || row.team.logo;
  const logo = highResolutionCap(row.team) || fallbackLogo;
  const url = teamUrl(row.team);
  return `
    <tr class="season-standings-row" data-team-url="${escapeHtml(url)}" tabindex="0" role="link" aria-label="Open ${escapeHtml(row.team.name)} team page">
      <th class="season-team-cell">
        <a href="${escapeHtml(url)}">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" ${fallbackLogo && fallbackLogo !== logo ? `onerror="this.onerror=null;this.src='${escapeHtml(fallbackLogo)}';"` : ""}>` : ""}
          <span>${escapeHtml(row.team.name)}</span>
        </a>
      </th>
      <td>${numberValue(row.wins)}</td>
      <td>${numberValue(row.losses)}</td>
      <td>${pctValue(row.winPct)}</td>
      <td>${numberValue(row.conferenceRank)}</td>
      <td>${numberValue(row.averagePerWeek, 2)}</td>
      <td>${numberValue(row.divisionWins)}</td>
      <td>${numberValue(row.divisionLosses)}</td>
      <td>${numberValue(row.conferenceWins)}</td>
      <td>${numberValue(row.conferenceLosses)}</td>
      <td>${escapeHtml(row.streak)}</td>
      <td>${numberValue(row.plusMinus)}</td>
      <td>${percentToAverage(row.toAverage)}</td>
      <td>${numberValue(row.offense)}</td>
      <td>${numberValue(row.pitching)}</td>
      <td>${numberValue(row.totalPoints)}</td>
    </tr>
  `;
}

function wireStandingsLinks() {
  standingsEl.querySelectorAll(".season-standings-row[data-team-url]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      window.location.href = row.dataset.teamUrl;
    });

    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = row.dataset.teamUrl;
    });
  });
}

function highResolutionCap(team) {
  const cap = team.capImage || "";
  if (!cap) return "";
  if (cap.includes("768x541")) return cap.replace("768x541", "1024x722");
  if (cap.includes("768-541")) return cap.replace("768-541", "1024x722");
  return cap;
}

async function loadStandings() {
  try {
    const weeks = await loadSeasonResults();
    const rows = buildStandings(weeks);
    renderStandings(rows, weeks.length);
  } catch (error) {
    statusEl.textContent = `Could not load standings: ${error.message}`;
    standingsEl.innerHTML = "";
  }
}

loadStandings();
