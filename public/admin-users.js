import { getSupabaseClient, requireSession, signOut } from "./auth.js";

const statusEl = document.querySelector("#user-status");
const tableBody = document.querySelector("#users-table-body");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");
const userDialog = document.querySelector("#user-dialog");
const userEditForm = document.querySelector("#user-edit-form");
const closeUserDialogButton = document.querySelector("#close-user-dialog-button");
const editUserIdEl = document.querySelector("#edit-user-id");
const editDisplayNameEl = document.querySelector("#edit-display-name");
const editEmailEl = document.querySelector("#edit-email");
const editTeamIdEl = document.querySelector("#edit-team-id");
const editRoleEl = document.querySelector("#edit-role");
const editActiveEl = document.querySelector("#edit-active");
const editAdminEl = document.querySelector("#edit-admin");

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
        <td>${escapeHtml(user.display_name || "Name not set")}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(assignment?.team_name || "No team")}</td>
        <td>${escapeHtml(assignment?.role === "co_owner" ? "Co-owner" : assignment ? "Owner" : "")}</td>
        <td>${assignment ? (assignment.active ? "Yes" : "No") : ""}</td>
        <td>${user.is_admin ? "Yes" : "No"}</td>
        <td><button class="admin-secondary table-action" type="button" data-edit-user>Edit</button></td>
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

function openUserDialog(userId) {
  const user = users.find((item) => item.user_id === userId);
  if (!user) return;

  const assignment = assignmentFor(userId);
  editUserIdEl.value = user.user_id;
  editDisplayNameEl.value = user.display_name || "";
  editEmailEl.value = user.email || "";
  editTeamIdEl.innerHTML = teamOptions(assignment?.team_id);
  editRoleEl.value = assignment?.role || "owner";
  editActiveEl.checked = assignment?.active !== false;
  editAdminEl.checked = Boolean(user.is_admin);
  userDialog.showModal();
  editDisplayNameEl.focus();
}

async function saveUserFromDialog() {
  const userId = editUserIdEl.value;
  const displayName = editDisplayNameEl.value.trim();
  const teamId = editTeamIdEl.value;
  const role = editRoleEl.value;
  const active = editActiveEl.checked;
  const makeAdmin = editAdminEl.checked;

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

  userDialog.close();
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
  const button = event.target.closest("[data-edit-user]");
  if (!button) return;
  const row = button.closest("tr");
  openUserDialog(row.dataset.userId);
});
closeUserDialogButton.addEventListener("click", () => userDialog.close());
userEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveUserFromDialog().catch((error) => setStatus(`Save failed: ${error.message}`, "error"));
});
