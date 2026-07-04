import { getSupabaseClient, requireSession, signOut } from "./auth.js";

const statusEl = document.querySelector("#user-status");
const tableBody = document.querySelector("#users-table-body");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");

let supabase = null;
let currentUserId = "";
let users = [];
let teams = [];
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

function teamOptions(selectedTeamId) {
  return [
    `<option value="">No team</option>`,
    ...teams.map((team) => (
      `<option value="${team.id}" ${String(team.id) === String(selectedTeamId || "") ? "selected" : ""}>${escapeHtml(team.name)}</option>`
    ))
  ].join("");
}

function assignmentFor(userId) {
  return assignments.find((assignment) => assignment.user_id === userId && assignment.active)
    || assignments.find((assignment) => assignment.user_id === userId)
    || null;
}

function renderUsers() {
  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="7">No users yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = users.map((user) => {
    const assignment = assignmentFor(user.user_id);
    return `
      <tr data-user-id="${user.user_id}">
        <td><input data-field="displayName" value="${escapeHtml(user.display_name || "")}"></td>
        <td>${escapeHtml(user.email)}</td>
        <td><select data-field="teamId">${teamOptions(assignment?.team_id)}</select></td>
        <td>
          <select data-field="role">
            <option value="owner" ${assignment?.role === "owner" ? "selected" : ""}>Owner</option>
            <option value="co_owner" ${assignment?.role === "co_owner" ? "selected" : ""}>Co-owner</option>
          </select>
        </td>
        <td><input data-field="active" type="checkbox" ${assignment?.active !== false ? "checked" : ""}></td>
        <td><input data-field="admin" type="checkbox" ${user.is_admin ? "checked" : ""}></td>
        <td><button class="admin-secondary table-action" type="button" data-save-user>Save</button></td>
      </tr>
    `;
  }).join("");
}

async function loadData() {
  setStatus("Loading users...");
  const [usersResult, teamsResult, assignmentsResult] = await Promise.all([
    supabase.from("public_user_admin").select("*").order("display_name"),
    supabase.from("teams").select("id, name, city").eq("active", true).order("city", { nullsFirst: false }).order("name"),
    supabase.from("public_team_owner_assignments").select("*").order("owner_name")
  ]);

  if (usersResult.error) throw usersResult.error;
  if (teamsResult.error) throw teamsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  users = usersResult.data || [];
  teams = teamsResult.data || [];
  assignments = assignmentsResult.data || [];
  renderUsers();
  const userCount = `${users.length} user${users.length === 1 ? "" : "s"}`;
  if (!teams.length) {
    setStatus(`Loaded ${userCount}, but no active teams came back from Supabase. Run supabase/seed_teams.sql.`, "error");
    return;
  }
  setStatus(`Loaded ${userCount} and ${teams.length} team${teams.length === 1 ? "" : "s"}.`);
}

async function saveUser(row) {
  const userId = row.dataset.userId;
  const displayName = row.querySelector('[data-field="displayName"]').value.trim();
  const teamId = row.querySelector('[data-field="teamId"]').value;
  const role = row.querySelector('[data-field="role"]').value;
  const active = row.querySelector('[data-field="active"]').checked;
  const makeAdmin = row.querySelector('[data-field="admin"]').checked;

  if (!displayName) {
    throw new Error("Name is required before saving.");
  }

  if (userId === currentUserId && !makeAdmin) {
    throw new Error("You cannot remove your own admin access from this page.");
  }

  setStatus("Saving user...");

  const selectedTeam = teams.find((team) => String(team.id) === String(teamId));
  const { error } = await supabase.rpc("save_admin_user", {
    p_user_id: userId,
    p_display_name: displayName,
    p_team_id: teamId ? Number(teamId) : null,
    p_role: role,
    p_active: active,
    p_is_admin: makeAdmin
  });
  if (error) throw error;

  if (teamId) {
    setStatus(`${displayName} saved${selectedTeam ? ` for ${selectedTeam.name}` : ""}.`);
  } else {
    setStatus(`${displayName} saved with no active team.`);
  }

  await loadData();
}

try {
  const session = await requireSession();
  currentUserId = session?.user?.id || "";
  supabase = await getSupabaseClient();
  await loadData();
} catch (error) {
  setStatus(error.message, "error");
}

refreshButton.addEventListener("click", () => {
  loadData().catch((error) => setStatus(`Refresh failed: ${error.message}`, "error"));
});
logoutButton.addEventListener("click", signOut);
tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-user]");
  if (!button) return;
  const row = button.closest("tr");
  saveUser(row).catch((error) => setStatus(`Save failed: ${error.message}`, "error"));
});
