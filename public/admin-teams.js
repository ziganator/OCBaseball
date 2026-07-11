import {
  displayTeam,
  favoriteTeams as seedFavoriteTeams,
  teams as seedTeams,
  teamCity
} from "./team-data.js?v=20260708c";
import { getSupabaseClient, requireSession, signOut } from "./auth.js";

const DRAFT_KEY = "ownersclub.teamAdminDraft";
const form = document.querySelector("#team-form");
const statusEl = document.querySelector("#admin-status");
const teamSelect = document.querySelector("#team-select");
const favoriteSelect = document.querySelector("#favorite-team-select");
const logoutButton = document.querySelector("#logout-button");
const newTeamButton = document.querySelector("#new-team-button");
const saveLocalButton = document.querySelector("#save-local-button");
const saveSupabaseButton = document.querySelector("#save-supabase-button");
const exportButton = document.querySelector("#export-button");
const favoriteDialog = document.querySelector("#favorite-dialog");
const openFavoriteDialogButton = document.querySelector("#open-favorite-dialog-button");
const closeFavoriteDialogButton = document.querySelector("#close-favorite-dialog-button");
const addFavoriteButton = document.querySelector("#add-favorite-button");

let state = loadDraft() || {
  favoriteTeams: structuredClone(seedFavoriteTeams),
  teams: structuredClone(seedTeams)
};
state = normalizeDraftState(state);
let activeSlug = state.teams[0]?.slug || "";
let session = null;

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

try {
  session = await requireSession();
} catch (error) {
  setStatus(error.message, "error");
}

async function loadDatabaseTeamData() {
  if (!session) return;
  try {
    const supabase = await getSupabaseClient();
    const { data: published, error: publishedError } = await supabase
      .from("team_site_data")
      .select("site_data")
      .eq("data_key", "team-data")
      .maybeSingle();

    if (publishedError) throw publishedError;
    if (published?.site_data?.teams && published?.site_data?.favoriteTeams) {
      state = normalizeDraftState(published.site_data);
      activeSlug = state.teams.some((team) => team.slug === activeSlug) ? activeSlug : state.teams[0]?.slug || "";
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      return;
    }

    const { data: draft, error: draftError } = await supabase
      .from("team_admin_drafts")
      .select("draft_data")
      .eq("draft_key", "team-data")
      .maybeSingle();

    if (draftError) throw draftError;
    if (draft?.draft_data?.teams && draft?.draft_data?.favoriteTeams) {
      state = normalizeDraftState(draft.draft_data);
      activeSlug = state.teams.some((team) => team.slug === activeSlug) ? activeSlug : state.teams[0]?.slug || "";
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }
  } catch (error) {
    setStatus(`Could not load saved team data: ${error.message}`, "error");
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeDraftState(draft) {
  const next = {
    favoriteTeams: draft.favoriteTeams || structuredClone(seedFavoriteTeams),
    teams: draft.teams || structuredClone(seedTeams)
  };

  next.teams.forEach((team) => {
    team.nickname ||= team.shortName || "";
    team.city ||= teamCity(team);
    team.name = [team.city, team.nickname || team.shortName].filter(Boolean).join(" ");
    team.shortName = team.nickname || team.shortName || "";
    if (team.identityHistory && team.slug !== "new-york-donkeys") {
      delete team.identityHistory;
    }
  });

  const highlanders = next.teams.find((team) => team.slug === "cleveland-highlanders");
  if (highlanders?.identityHistory) {
    highlanders.identityHistory = highlanders.identityHistory.filter((entry) => {
      const text = `${entry.originalIdentity || ""} ${entry.seasonIdentity || ""}`.toLowerCase();
      return !text.includes("captains") && !text.includes("donkeys");
    });
    if (highlanders.identityHistory.length === 0) {
      delete highlanders.identityHistory;
    }
  }

  const donkeys = next.teams.find((team) => team.slug === "new-york-donkeys");
  if (donkeys && !donkeys.identityHistory?.length) {
    donkeys.identityHistory = [{
      season: "32",
      originalIdentity: "New York Captains",
      seasonIdentity: "New York Donkeys",
      notes: "Uses Donkeys identity for this season."
    }];
  }

  return next;
}

function activeTeam() {
  return state.teams.find((team) => team.slug === activeSlug) || state.teams[0];
}

function associateFavoriteWithActiveTeam(key = form.elements.favoriteTeam?.value || "") {
  const team = activeTeam();
  if (!team) return;
  team.favoriteTeam = key;
  if (form.elements.favoriteTeam) {
    form.elements.favoriteTeam.value = key;
  }
}

function syncCurrentTeamFromForm() {
  const team = activeTeam();
  if (!team) return;
  const data = new FormData(form);
  const oldSlug = team.slug;
  const city = data.get("city").trim();
  const nickname = data.get("nickname").trim();

  team.slug = data.get("slug").trim();
  team.city = city;
  team.nickname = nickname;
  team.name = [city, nickname].filter(Boolean).join(" ");
  team.shortName = nickname;
  team.owner = data.get("owner").trim();
  team.established = data.get("established").trim();
  team.league = data.get("league");
  team.conference = data.get("conference");
  team.division = data.get("division").trim();
  associateFavoriteWithActiveTeam(data.get("favoriteTeam") || "");
  team.capImage = data.get("capImage").trim();
  team.listBanner = team.capImage || team.listBanner;
  team.logo = data.get("logo").trim();
  team.featureImage = team.logo || team.featureImage;
  team.flagsImage = data.get("flagsImage").trim();
  team.accent = team.flagsImage || team.accent;
  team.infoImage = data.get("infoImage").trim();
  team.colorBar = {
    background: data.get("colorBarBackground") || "#1f3d29",
    accent: data.get("colorBarAccent") || "#d9c79e"
  };
  team.seasonIdentity = {
    useDonkeys: data.get("useDonkeysIdentity") === "on"
  };
  if (!team.seasonIdentity.useDonkeys) {
    delete team.seasonIdentity;
  }

  if (!team.rosterImages) {
    team.rosterImages = [];
  }
  if (team.infoImage && !team.rosterImages.includes(team.infoImage)) {
    team.rosterImages[1] = team.infoImage;
  }

  if (oldSlug !== team.slug) {
    activeSlug = team.slug;
  }
}

function renderSelectors() {
  teamSelect.innerHTML = [...state.teams]
    .sort((a, b) => teamCity(a).localeCompare(teamCity(b)) || displayTeam(a).name.localeCompare(displayTeam(b).name))
    .map((team) => `<option value="${team.slug}">${displayTeam(team).name}</option>`)
    .join("");
  teamSelect.value = activeSlug;

  favoriteSelect.innerHTML = [
    `<option value="">Pending</option>`,
    ...Object.entries(state.favoriteTeams).map(([key, item]) => (
      `<option value="${key}">${item.name}</option>`
    ))
  ].join("");
}

function renderForm() {
  const team = activeTeam();
  if (!team) return;

  renderSelectors();
  const city = team.city || teamCity(team);
  const nickname = team.nickname || team.shortName || "";
  form.elements.slug.value = team.slug || "";
  form.elements.city.value = city;
  form.elements.nickname.value = nickname;
  form.elements.owner.value = team.owner || "";
  form.elements.established.value = team.established || "";
  form.elements.league.value = team.league || "Keystone";
  form.elements.conference.value = team.conference || "Red";
  form.elements.division.value = team.division || "";
  form.elements.favoriteTeam.value = team.favoriteTeam || "";
  form.elements.capImage.value = team.capImage || "";
  form.elements.logo.value = team.logo || "";
  form.elements.flagsImage.value = team.flagsImage || "";
  form.elements.infoImage.value = team.infoImage || "";
  form.elements.colorBarBackground.value = team.colorBar?.background || "#1f3d29";
  form.elements.colorBarAccent.value = team.colorBar?.accent || "#d9c79e";
  form.elements.useDonkeysIdentity.checked = Boolean(team.seasonIdentity?.useDonkeys);
}

function addTeam() {
  syncCurrentTeamFromForm();
  const city = "New";
  const nickname = "Team";
  const slug = uniqueSlug(slugify(`${city} ${nickname}`));
  state.teams.push({
    slug,
    city,
    nickname,
    name: `${city} ${nickname}`,
    shortName: nickname,
    league: "Keystone",
    conference: "Red",
    division: "",
    established: "",
    owner: "",
    capImage: "",
    colorBar: { background: "#1f3d29", accent: "#d9c79e" },
    logo: "",
    favoriteTeam: "",
    flagsImage: "",
    featureImage: "",
    infoImage: "",
    rosterImages: []
  });
  activeSlug = slug;
  renderForm();
}

function uniqueSlug(base) {
  let slug = base || "new-team";
  let index = 2;
  while (state.teams.some((team) => team.slug === slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function addFavoriteTeam() {
  syncCurrentTeamFromForm();
  const keyEl = document.querySelector("#favorite-key");
  const nameEl = document.querySelector("#favorite-name");
  const logoEl = document.querySelector("#favorite-logo");
  const key = slugify(keyEl.value).replaceAll("-", "");

  if (!key || !nameEl.value.trim() || !logoEl.value.trim()) {
    setStatus("Favorite team key, name, and logo path are required.", "error");
    return;
  }

  state.favoriteTeams[key] = {
    name: nameEl.value.trim(),
    logo: logoEl.value.trim()
  };

  const team = activeTeam();
  if (team) {
    associateFavoriteWithActiveTeam(key);
  }

  renderSelectors();
  associateFavoriteWithActiveTeam(key);
  keyEl.value = "";
  nameEl.value = "";
  logoEl.value = "";
  favoriteDialog.close();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  setStatus(`Favorite team reference added and selected for ${team?.name || "this team"}.`);
}

function saveLocal() {
  syncCurrentTeamFromForm();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  setStatus("Browser backup saved on this device.");
  renderSelectors();
}

async function saveSupabaseDraft() {
  if (!session) {
    setStatus("Log in with Supabase Auth before saving a database draft.", "error");
    return;
  }
  syncCurrentTeamFromForm();
  associateFavoriteWithActiveTeam();
  setStatus("Saving teams to Supabase...");

  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from("team_admin_drafts")
      .upsert({
        draft_key: "team-data",
        draft_data: state,
        updated_by: session.user.id
      }, { onConflict: "draft_key" });

    if (error) throw error;
    const { error: publishError } = await supabase
      .from("team_site_data")
      .upsert({
        data_key: "team-data",
        site_data: state,
        updated_by: session.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "data_key" });

    if (publishError) {
      setStatus(`Teams saved privately, but public team pages were not updated: ${publishError.message}`, "error");
      return;
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    setStatus("Teams saved to Supabase and published to team pages.");
  } catch (error) {
    setStatus(`Supabase team save failed: ${error.message}`, "error");
  }
}

function cleanTeam(team) {
  return Object.fromEntries(
    Object.entries(team).filter(([, value]) => (
      value !== "" &&
      value !== null &&
      value !== undefined &&
      !(Array.isArray(value) && value.length === 0)
    ))
  );
}

function exportTeamData() {
  syncCurrentTeamFromForm();
  const favoriteText = JSON.stringify(state.favoriteTeams, null, 2)
    .replace(/"([^"]+)":/g, "$1:");
  const teamsText = JSON.stringify(state.teams.map(cleanTeam), null, 2)
    .replace(/"([^"]+)":/g, "$1:");
  const source = `export const favoriteTeams = ${favoriteText};\n\nexport const donkeysIdentity = {\n  nickname: "Donkeys",\n  banner: "/assets/TeamImages/New%20York%20Captains/DONK-Banner-1024x722.jpg",\n  listBanner: "/assets/TeamImages/New%20York%20Captains/DONK-Banner-768x541.jpg",\n  capImage: "/assets/TeamImages/New%20York%20Captains/DONK-Cap-768x541.jpg",\n  colorBar: { background: "#714214", accent: "#947453" },\n  logo: "/assets/TeamImages/New%20York%20Captains/NY-DONK-Logo-768x593.jpg",\n  featureImage: "/assets/TeamImages/New%20York%20Captains/NY-DONK-Logo-768x593.jpg"\n};\n\nexport const teams = ${teamsText};\n\nexport function findTeam(slug) {\n  return teams.find((team) => team.slug === slug);\n}\n\nexport function teamCity(team) {\n  if (team.city) return team.city;\n  const nickname = team.nickname || team.shortName || "";\n  if (nickname && team.name?.endsWith(\` ${'${nickname}'}\`)) {\n    return team.name.slice(0, -nickname.length).trim();\n  }\n  return team.name || "";\n}\n\nexport function displayTeam(team) {\n  if (!team?.seasonIdentity?.useDonkeys) {\n    return team;\n  }\n\n  const city = teamCity(team);\n  return {\n    ...team,\n    city,\n    nickname: donkeysIdentity.nickname,\n    shortName: donkeysIdentity.nickname,\n    name: \`${'${city}'} ${'${donkeysIdentity.nickname}'}\`.trim(),\n    banner: donkeysIdentity.banner,\n    listBanner: donkeysIdentity.listBanner,\n    capImage: donkeysIdentity.capImage,\n    colorBar: donkeysIdentity.colorBar,\n    logo: donkeysIdentity.logo,\n    featureImage: donkeysIdentity.featureImage\n  };\n}\n\nexport function teamUrl(team) {\n  return \`/teams/${'${encodeURIComponent(team.slug)}'}/\`;\n}\n`;
  const blob = new Blob([source], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "team-data.js";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Generated team-data.js.");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
});
teamSelect.addEventListener("change", () => {
  syncCurrentTeamFromForm();
  activeSlug = teamSelect.value;
  renderForm();
});
form.addEventListener("input", () => {
  const fullName = `${form.elements.city.value} ${form.elements.nickname.value}`.trim();
  if (fullName && !form.elements.slug.value) {
    form.elements.slug.value = uniqueSlug(slugify(fullName));
  }
});
openFavoriteDialogButton.addEventListener("click", () => {
  favoriteDialog.showModal();
});
closeFavoriteDialogButton.addEventListener("click", () => {
  favoriteDialog.close();
});
newTeamButton.addEventListener("click", addTeam);
saveLocalButton.addEventListener("click", saveLocal);
saveSupabaseButton.addEventListener("click", saveSupabaseDraft);
exportButton.addEventListener("click", exportTeamData);
addFavoriteButton.addEventListener("click", addFavoriteTeam);
logoutButton.addEventListener("click", signOut);

await loadDatabaseTeamData();
renderForm();
if (!statusEl.textContent) {
  setStatus(`Logged in as ${session?.user?.email || "admin"}.`);
}
