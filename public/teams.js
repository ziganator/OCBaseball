import { displayTeam, teams, teamUrl } from "./team-data.js?v=20260704c";

const teamsBoard = document.querySelector("#teams-board");

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

teamsBoard.innerHTML = `${renderLeague("Keystone")}${renderLeague("Diamond")}`;

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
