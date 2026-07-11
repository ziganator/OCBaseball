import { displayTeam as seedDisplayTeam, teams as seedTeams, teamUrl } from "./team-data.js?v=20260708c";

const teamsBoard = document.querySelector("#teams-board");
let teams = seedTeams;
let displayTeam = seedDisplayTeam;

function logoFor(team) {
  return team.capImage || team.listBanner || team.banner;
}

function renderLeague(leagueName) {
  const leagueTeams = teams
    .filter((team) => team.league === leagueName)
    .sort((a, b) => displayTeam(a).name.localeCompare(displayTeam(b).name));
  const leagueImage = leagueName === "Keystone" ? "/assets/Keystone.png" : "/assets/Diamond.png";

  return `
    <section class="league-column" aria-label="${leagueName} League teams">
      <div class="league-logo-panel">
        <img src="${leagueImage}" alt="${leagueName} League">
      </div>
      <div class="team-accordion">
        ${leagueTeams.map((sourceTeam) => {
          const team = displayTeam(sourceTeam);
          return `
          <details class="team-row">
            <summary>${team.name}</summary>
            <div class="team-row-panel">
              <a class="team-row-image-link" href="${teamUrl(sourceTeam)}" aria-label="Open ${team.name} page">
                <img src="${logoFor(team)}" alt="${team.name}">
              </a>
              <div>
                <strong>${team.conference} Conference / ${team.division} Division</strong>
              </div>
            </div>
          </details>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

async function loadPublishedTeamData() {
  try {
    const response = await fetch("/api/team-site-data", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload.data?.teams) return;
    teams = payload.data.teams;
    displayTeam = (source) => source;
  } catch {
    // Static team-data.js remains the fallback.
  }
}

function renderBoard() {
  teamsBoard.innerHTML = `${renderLeague("Keystone")}${renderLeague("Diamond")}`;
}

loadPublishedTeamData().finally(renderBoard);

teamsBoard.addEventListener("toggle", (event) => {
  const openedRow = event.target;
  if (!(openedRow instanceof HTMLDetailsElement) || !openedRow.open) {
    return;
  }

  const leagueColumn = openedRow.closest(".league-column");
  leagueColumn?.querySelectorAll(".team-row[open]").forEach((row) => {
    if (row !== openedRow) {
      row.open = false;
    }
  });
}, true);
