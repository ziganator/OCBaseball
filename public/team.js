import { displayTeam, favoriteTeams, findTeam, teams } from "./team-data.js?v=20260704g";

const params = new URLSearchParams(window.location.search);
const pathParts = window.location.pathname.split("/").filter(Boolean);
const pathSlug = pathParts[0] === "teams" && pathParts.length > 1 ? pathParts[1] : "";
const slug = params.get("team") || pathSlug || teams[0].slug;
const sourceTeam = findTeam(slug) || teams[0];
const team = displayTeam(sourceTeam);

function teamImage(src, alt) {
  return src ? `<img src="${src}" alt="${alt}">` : "";
}

function favoriteTeamFor(team) {
  if (team.favoriteTeam && favoriteTeams[team.favoriteTeam]) {
    return favoriteTeams[team.favoriteTeam];
  }

  if (team.ownerLogo) {
    return {
      name: "Favorite team",
      logo: team.ownerLogo
    };
  }

  return null;
}

function renderTeamPage() {
  const capImage = team.capImage || team.listBanner || team.banner || team.logo;
  const flagsImage = team.flagsImage || (team.accent?.includes("Banners-") ? team.accent : "");
  const infoImage = team.infoImage || team.rosterImages?.[1] || "";
  const barBackground = team.colorBar?.background || "#1f3d29";
  const barAccent = team.colorBar?.accent || "#d9c79e";
  const favoriteTeam = favoriteTeamFor(team);

  document.title = `${team.name} - Owners Club Baseball`;
  document.body.classList.add("team-page-hermanos");
  document.querySelector("main").innerHTML = `
    <section class="hermanos-colorbar" style="--team-bar-bg: ${barBackground}; --team-bar-accent: ${barAccent};" aria-label="${team.name} color bar">
      <div class="hermanos-cap-mark">
        ${teamImage(capImage, `${team.name} cap`)}
      </div>
    </section>

    ${flagsImage ? `
      <section class="hermanos-flags">
        ${teamImage(flagsImage, `${team.name} flags`)}
      </section>
    ` : ""}

    <section class="hermanos-logo">
      ${teamImage(team.logo || team.featureImage, `${team.name} logo`)}
    </section>

    <section class="hermanos-profile">
      <div class="rule"></div>
      <div class="hermanos-profile-title">
        <a class="back-link" href="/teams.html">Teams</a>
        <h1>${team.name}</h1>
        <p>${team.league} League / ${team.conference} Conference / ${team.division} Division</p>
      </div>
      <div class="rule"></div>

      <div class="hermanos-profile-meta">
        <div>
          <span>Owner</span>
          <strong>${team.owner || "Pending"}</strong>
        </div>
        <div>
          <span>Established</span>
          <strong>${team.established || "Pending"}</strong>
        </div>
        <div>
          <span>Favorite Team</span>
          ${favoriteTeam ? teamImage(favoriteTeam.logo, favoriteTeam.name) : `<strong>Pending</strong>`}
        </div>
      </div>

      <div class="hermanos-actions" aria-label="${team.name} actions">
        <a href="#">History</a>
        <a href="#">Event Cards</a>
      </div>
    </section>

    ${infoImage ? `
      <section class="hermanos-info-sheet">
        ${teamImage(infoImage, `${team.name} team information`)}
      </section>
    ` : ""}
  `;
}

renderTeamPage();
