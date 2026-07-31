import { getSupabaseClient, requireSession, signOut } from "./auth.js";

const statusEl = document.querySelector("#card-admin-status");
const teamSelect = document.querySelector("#deal-team");
const cardSelect = document.querySelector("#deal-card");
const deckBody = document.querySelector("#deck-table-body");
const handsBody = document.querySelector("#hands-table-body");
const activityBody = document.querySelector("#activity-table-body");
const dealButton = document.querySelector("#deal-button");
const syncButton = document.querySelector("#sync-catalog-button");
const refreshButton = document.querySelector("#refresh-card-button");
const logoutButton = document.querySelector("#logout-button");
let supabase;
let teams = [];
let inventory = [];
let hands = [];
let activity = [];

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function setStatus(message, tone = "") { statusEl.textContent = message; statusEl.dataset.tone = tone; }
function cardName(url) {
  const file = decodeURIComponent(String(url).split("/").pop() || "").replace(/\.(jpg|jpeg|png|webp)$/i, "").replace(/-1$/, "");
  return file.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function render() {
  teamSelect.innerHTML = teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("");
  cardSelect.innerHTML = `<option value="">Random from available deck</option>` + inventory.filter((card) => card.active && card.available_copies > 0).map((card) => `<option value="${card.card_type_id}">${escapeHtml(card.name)} (${card.available_copies} available)</option>`).join("");
  deckBody.innerHTML = inventory.length ? inventory.map((card) => `<tr data-card-type-id="${card.card_type_id}"><td>${escapeHtml(card.name)}</td><td><input type="number" min="${card.held_copies}" value="${card.total_copies}" data-total></td><td>${card.held_copies}</td><td><strong>${card.available_copies}</strong></td><td><button class="admin-secondary table-action" type="button" data-save-total>Save</button></td></tr>`).join("") : `<tr><td colspan="5">No card types yet. Sync the gallery catalog to begin.</td></tr>`;
  handsBody.innerHTML = hands.length ? hands.map((holding) => `<tr data-holding-id="${holding.holding_id}"><td>${escapeHtml(holding.team_name)}</td><td>${escapeHtml(holding.card_name)}</td><td>${new Date(holding.assigned_at).toLocaleString()}</td><td><button class="admin-secondary table-action" type="button" data-release="played">Played</button> <button class="admin-secondary table-action" type="button" data-release="returned">Return</button></td></tr>`).join("") : `<tr><td colspan="4">No cards are currently held by teams.</td></tr>`;
  activityBody.innerHTML = activity.length ? activity.map((row) => `<tr><td>${new Date(row.occurred_at).toLocaleString()}</td><td>${escapeHtml(row.teams?.name || "")}</td><td>${escapeHtml(row.event_card_types?.name || "")}</td><td>${escapeHtml(row.action.replaceAll("_", " "))}</td></tr>`).join("") : `<tr><td colspan="4">No card activity yet.</td></tr>`;
}

async function loadData() {
  setStatus("Loading deck and team hands...");
  const [teamsResult, inventoryResult, handsResult, activityResult] = await Promise.all([
    supabase.from("teams").select("id,name").eq("active", true).order("name"),
    supabase.from("event_card_inventory").select("*").order("name"),
    supabase.from("event_card_hands").select("*").order("team_name").order("assigned_at"),
    supabase.from("event_card_activity").select("id,action,occurred_at,event_card_types(name),teams(name)").order("occurred_at", { ascending: false }).limit(200)
  ]);
  for (const result of [teamsResult, inventoryResult, handsResult, activityResult]) if (result.error) throw result.error;
  teams = teamsResult.data || []; inventory = inventoryResult.data || []; hands = handsResult.data || []; activity = activityResult.data || [];
  render(); setStatus(`${inventory.length} card types; ${hands.length} cards currently in team hands.`);
}

async function syncCatalog() {
  setStatus("Reading the Event Card gallery...");
  const html = await fetch("/event-cards.html", { cache: "no-store" }).then((response) => response.text());
  const urls = [...new Set(html.match(/https:\/\/oceventcards\.com\/wp-content\/uploads\/[^"']+\.(?:jpg|jpeg|png|webp)/gi) || [])];
  if (!urls.length) throw new Error("No gallery cards were found.");
  const rows = urls.map((imageUrl) => ({ slug: slugify(cardName(imageUrl)), name: cardName(imageUrl), image_url: imageUrl, active: true }));
  const { error } = await supabase.from("event_card_types").upsert(rows, { onConflict: "slug", ignoreDuplicates: false });
  if (error) throw error;
  setStatus(`Synced ${rows.length} card types. Set the physical copy totals before dealing.`); await loadData();
}

async function dealCard() {
  if (!teamSelect.value) throw new Error("Select a team.");
  setStatus("Dealing card...");
  const { data, error } = await supabase.rpc("commissioner_assign_event_card", { p_team_id: Number(teamSelect.value), p_card_type_id: cardSelect.value ? Number(cardSelect.value) : null });
  if (error) throw error;
  const dealt = data?.[0]; setStatus(`${dealt?.card_name || "Card"} assigned to ${dealt?.team_name || "team"}.`); await loadData();
}

async function saveTotal(row) {
  const total = Number(row.querySelector("[data-total]").value);
  const { error } = await supabase.rpc("commissioner_set_event_card_total", { p_card_type_id: Number(row.dataset.cardTypeId), p_total_copies: total });
  if (error) throw error; await loadData();
}
async function releaseCard(row, action) {
  const { error } = await supabase.rpc("commissioner_release_event_card", { p_holding_id: Number(row.dataset.holdingId), p_action: action });
  if (error) throw error; setStatus(action === "played" ? "Played card returned to the deck." : "Card returned to the deck."); await loadData();
}

try {
  const session = await requireSession(); supabase = await getSupabaseClient();
  const { data: isCommissioner, error } = await supabase.rpc("is_commissioner_user", { check_user_id: session.user.id });
  if (error) throw error; if (!isCommissioner) throw new Error("Commissioner access is required.");
  await loadData();
} catch (error) { setStatus(error.message, "error"); }

logoutButton.addEventListener("click", signOut);
refreshButton.addEventListener("click", () => loadData().catch((error) => setStatus(error.message, "error")));
syncButton.addEventListener("click", () => syncCatalog().catch((error) => setStatus(error.message, "error")));
dealButton.addEventListener("click", () => dealCard().catch((error) => setStatus(error.message, "error")));
deckBody.addEventListener("click", (event) => { const button = event.target.closest("[data-save-total]"); if (button) saveTotal(button.closest("tr")).catch((error) => setStatus(error.message, "error")); });
handsBody.addEventListener("click", (event) => { const button = event.target.closest("[data-release]"); if (button) releaseCard(button.closest("tr"), button.dataset.release).catch((error) => setStatus(error.message, "error")); });
