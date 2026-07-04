import { getSupabaseClient, requireSession, signOut } from "./auth.js";

const form = document.querySelector("#owner-form");
const statusEl = document.querySelector("#owner-status");
const teamSelect = form.elements.teamId;
const seasonSelect = form.elements.seasonId;
const tableBody = document.querySelector("#owners-table-body");
const refreshButton = document.querySelector("#refresh-button");
const clearButton = document.querySelector("#clear-button");
const logoutButton = document.querySelector("#logout-button");

let session = null;
let supabase = null;
let teams = [];
let seasons = [];
let assignments = [];

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function seasonLabel(assignment) {
  if (!assignment.season_id) return "All seasons";
  if (assignment.season_number) return `Season ${assignment.season_number}`;
  return assignment.season_name || `Season ID ${assignment.season_id}`;
}

function renderOptions() {
  teamSelect.innerHTML = teams
    .map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`)
    .join("");

  seasonSelect.innerHTML = [
    `<option value="">All seasons</option>`,
    ...seasons.map((season) => (
      `<option value="${season.id}">Season ${season.season_number} - ${escapeHtml(season.name)}</option>`
    ))
  ].join("");
}

function renderAssignments() {
  if (!assignments.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">No owner assignments yet.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = assignments.map((assignment) => `
    <tr>
      <td>
        <strong>${escapeHtml(assignment.owner_name || assignment.owner_email || "Owner")}</strong>
        <span>${escapeHtml(assignment.owner_email || assignment.user_id)}</span>
      </td>
      <td>${escapeHtml(assignment.team_name)}</td>
      <td>${escapeHtml(seasonLabel(assignment))}</td>
      <td>${escapeHtml(assignment.role)}</td>
      <td>${assignment.active ? "Active" : "Inactive"}</td>
      <td>
        <button class="admin-secondary table-action" type="button" data-edit-id="${assignment.id}">Edit</button>
      </td>
    </tr>
  `).join("");
}

async function loadData() {
  setStatus("Loading owner assignments...");

  const [teamResult, seasonResult, assignmentResult] = await Promise.all([
    supabase.from("teams").select("id, name").eq("active", true).order("name"),
    supabase.from("seasons").select("id, season_number, name").order("season_number", { ascending: false }),
    supabase.from("public_team_owner_assignments").select("*").order("team_name")
  ]);

  if (teamResult.error) throw teamResult.error;
  if (seasonResult.error) throw seasonResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  teams = teamResult.data || [];
  seasons = seasonResult.data || [];
  assignments = assignmentResult.data || [];

  renderOptions();
  renderAssignments();
  setStatus(`Loaded ${assignments.length} owner assignment${assignments.length === 1 ? "" : "s"}.`);
}

function clearForm() {
  form.reset();
  form.elements.active.checked = true;
  delete form.dataset.assignmentId;
}

function editAssignment(id) {
  const assignment = assignments.find((item) => String(item.id) === String(id));
  if (!assignment) return;

  form.dataset.assignmentId = assignment.id;
  form.elements.ownerEmail.value = assignment.owner_email || "";
  form.elements.ownerName.value = assignment.owner_name || "";
  form.elements.userId.value = assignment.user_id || "";
  form.elements.teamId.value = assignment.team_id || "";
  form.elements.seasonId.value = assignment.season_id || "";
  form.elements.role.value = assignment.role || "owner";
  form.elements.active.checked = Boolean(assignment.active);
  setStatus(`Editing ${assignment.owner_name || assignment.owner_email || "owner assignment"}.`);
}

async function saveAssignment(event) {
  event.preventDefault();
  const data = new FormData(form);
  const assignmentId = form.dataset.assignmentId;
  const payload = {
    user_id: data.get("userId").trim(),
    owner_email: data.get("ownerEmail").trim() || null,
    owner_name: data.get("ownerName").trim() || null,
    team_id: Number(data.get("teamId")),
    season_id: data.get("seasonId") ? Number(data.get("seasonId")) : null,
    role: data.get("role"),
    active: data.get("active") === "on"
  };

  if (!payload.user_id || !payload.team_id) {
    setStatus("Auth user UUID and team are required.", "error");
    return;
  }

  setStatus("Saving owner assignment...");
  const request = assignmentId
    ? supabase.from("team_owner_users").update(payload).eq("id", assignmentId)
    : supabase.from("team_owner_users").upsert(payload, {
      onConflict: "user_id,team_id,season_id"
    });

  const { error } = await request;
  if (error) {
    setStatus(`Save failed: ${error.message}`, "error");
    return;
  }

  clearForm();
  await loadData();
  setStatus("Owner assignment saved.");
}

try {
  session = await requireSession();
  supabase = await getSupabaseClient();
  await loadData();
  setStatus(`Logged in as ${session?.user?.email || "admin"}.`);
} catch (error) {
  setStatus(error.message, "error");
}

form.addEventListener("submit", saveAssignment);
clearButton.addEventListener("click", clearForm);
refreshButton.addEventListener("click", () => {
  loadData().catch((error) => setStatus(`Refresh failed: ${error.message}`, "error"));
});
logoutButton.addEventListener("click", signOut);
tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (button) {
    editAssignment(button.dataset.editId);
  }
});
