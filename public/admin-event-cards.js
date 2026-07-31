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
const createCardForm = document.querySelector("#create-card-form");
let supabase;
let teams = [];
let inventory = [];
let hands = [];
let activity = [];

const CARD_TYPE_GROUPS = {
  epic: "1 Up|Bankrupt|Behind the Wheel|Big Market|Catch|Collateral Damage|Collusion|Communism|Compensation|Delegate|Draft Maneuver|Free Agent|Immunity Idol|Instigator|Justice League|Lifetime Contract|Memory Loss|No Trade Clause|Play With Fire|Raiders|Spinach|Tagged|The Box|To the Table|Trading Cards|Trending|Tuaca|Unholy Contract|Wild Card".split("|"),
  legendary: "Authoritarianism|Black Lotus|Bonus Baby|Chain Reaction|Chaos|Clone|Defender|Eminence Grise|Evil|Fate|History Eraser Button|Magician|Oprah|Powerslave|Revenue Sharing|Sherlock|The Eye|The Kingfish|Time Warp|Voltron|White Elephant|Wish".split("|"),
  rare: "All In|Arbitration|Bag of Holding|Bum Fight|C Block|Capitalism|Clique|Coconuts|Cost Cutting|Crystal Chamber|Friends|Gift Exchange|Kaboom|Nailed|Opt Out|Out of Options|Potato|Purge|Restructure|Reversal|Rivals|Sanctions|Schwarber Sux|Shawn Green|Silencio|Socialism|Supplementals|The Decider|The Franchise|Turf War|Twister|Unbreakable Vow|Undermine|Upgrade|Variant|Vigorish|Winning Streak".split("|"),
  uncommon: "440|Bait|Big Al|Called Shot|Core Unit|Count|Dead Cuban Money|Deflection|Doomsday Clock|Expedite|Extra Damage|Favoritism|Hombre|Klingon Proverb|Lock Box|Long Term Deal|Luxury Tax|Magic Number|Muck|O Fer|Odds Maker|Omniscience|Parlay|Randomize|Reverse Jinx|Reward|Robin Hood|Sabotage|Slump Buster|Smackdown|Sniper|Swipe|Time Out|Under the Radar|Vacant|Villain|Whistleblower|Zero".split("|"),
  common: "1 Year Extension|2 Year Extension|And 1|Cannonball|Enforcer|Madman|No Soup|Numbers|Pickpocket|Radical Inclusion|Renegotiation|Reveal|Sacrifice|Sandy Claws|Shield|Signed|Stop|Surplus|Sus|Taxman|The Man|Thumbs Up|Transform|Unlimited".split("|")
};
const CARD_TYPE_BY_SLUG = new Map(Object.entries(CARD_TYPE_GROUPS).flatMap(([type, names]) => names.map((name) => [slugify(name), type])));

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function setStatus(message, tone = "") { statusEl.textContent = message; statusEl.dataset.tone = tone; }
function cardName(url) {
  let file = decodeURIComponent(String(url).split("/").pop() || "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
  if (file === "Cannonball-1") file = "Cannonball";
  if (file === "SchwarberSux") file = "Schwarber-Sux";
  return file.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function render() {
  if (teamSelect) teamSelect.innerHTML = teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("");
  if (deckBody) deckBody.innerHTML = inventory.length ? inventory.map((card) => `<tr data-card-type-id="${card.card_type_id}"><td>${card.image_url ? `<a href="${escapeHtml(card.image_url)}" target="_blank" rel="noopener"><img class="deck-card-thumbnail" src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}"></a>` : `<span class="deck-card-placeholder">No image</span>`}</td><td>${escapeHtml(card.name)}</td><td><span class="card-rarity is-${card.rarity}">${escapeHtml(card.rarity)}</span></td><td><input class="card-total-input" type="number" min="${card.held_copies}" max="999" value="${card.total_copies}" data-total></td><td>${card.held_copies}</td><td><strong>${card.available_copies}</strong></td><td><button class="admin-secondary table-action" type="button" data-save-total>Save</button></td></tr>`).join("") : `<tr><td colspan="7">No card types yet. Sync the gallery catalog to begin.</td></tr>`;
  if (handsBody) handsBody.innerHTML = hands.length ? hands.map((holding) => `<tr data-holding-id="${holding.holding_id}"><td>${escapeHtml(holding.team_name)}</td><td>${escapeHtml(holding.card_name)}</td><td>${new Date(holding.assigned_at).toLocaleString()}</td><td><button class="admin-secondary table-action" type="button" data-release="played">Played</button> <button class="admin-secondary table-action" type="button" data-release="returned">Return</button></td></tr>`).join("") : `<tr><td colspan="4">No cards are currently held by teams.</td></tr>`;
  if (activityBody) activityBody.innerHTML = activity.length ? activity.map((row) => `<tr><td>${new Date(row.occurred_at).toLocaleString()}</td><td>${escapeHtml(row.teams?.name || "")}</td><td>${escapeHtml(row.event_card_types?.name || "")}</td><td>${escapeHtml(row.action.replaceAll("_", " "))}</td></tr>`).join("") : `<tr><td colspan="4">No card activity yet.</td></tr>`;
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
  const existingResult = await supabase.from("event_card_types").select("id,image_url");
  if (existingResult.error) throw existingResult.error;
  const existingByUrl = new Map((existingResult.data || []).map((card) => [card.image_url, card.id]));
  const rows = urls.map((imageUrl) => {
    const name = cardName(imageUrl);
    return { ...(existingByUrl.has(imageUrl) ? { id: existingByUrl.get(imageUrl) } : {}), slug: slugify(name), name, image_url: imageUrl, rarity: CARD_TYPE_BY_SLUG.get(slugify(name)) || "common", active: true };
  });
  const existingRows = rows.filter((row) => row.id);
  const newRows = rows.filter((row) => !row.id);
  if (existingRows.length) {
    const { error } = await supabase.from("event_card_types").upsert(existingRows, { onConflict: "id", ignoreDuplicates: false });
    if (error) throw error;
  }
  if (newRows.length) {
    const { error } = await supabase.from("event_card_types").upsert(newRows, { onConflict: "slug", ignoreDuplicates: false });
    if (error) throw error;
  }
  setStatus(`Synced ${rows.length} card types. Set the physical copy totals before dealing.`); await loadData();
}

async function dealCard() {
  if (!teamSelect.value) throw new Error("Select a team.");
  setStatus("Dealing card...");
  const { data, error } = await supabase.rpc("commissioner_assign_event_card", { p_team_id: Number(teamSelect.value), p_rarity: cardSelect.value || null });
  if (error) throw error;
  const dealt = data?.[0]; setStatus(`${dealt?.card_name || "Card"} assigned to ${dealt?.team_name || "team"}.`); await loadData();
}

async function createCard() {
  const name = document.querySelector("#new-card-name").value.trim();
  const rarity = document.querySelector("#new-card-rarity").value;
  const totalCopies = Number(document.querySelector("#new-card-total").value);
  const imageUrl = document.querySelector("#new-card-image").value.trim();
  if (!name) throw new Error("Enter a card name.");
  if (!Number.isInteger(totalCopies) || totalCopies < 0 || totalCopies > 999) throw new Error("Total copies must be between 0 and 999.");
  setStatus(`Creating ${name}...`);
  const { error } = await supabase.from("event_card_types").insert({ slug: slugify(name), name, rarity, total_copies: totalCopies, image_url: imageUrl || null, active: true });
  if (error) throw error;
  createCardForm.reset();
  document.querySelector("#new-card-total").value = "0";
  setStatus(`${name} was added to the deck.`);
  await loadData();
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
  await syncCatalog();
} catch (error) { setStatus(error.message, "error"); }

logoutButton?.addEventListener("click", signOut);
refreshButton?.addEventListener("click", () => loadData().catch((error) => setStatus(error.message, "error")));
syncButton?.addEventListener("click", () => syncCatalog().catch((error) => setStatus(error.message, "error")));
dealButton?.addEventListener("click", () => dealCard().catch((error) => setStatus(error.message, "error")));
createCardForm?.addEventListener("submit", (event) => { event.preventDefault(); createCard().catch((error) => setStatus(error.message, "error")); });
deckBody?.addEventListener("click", (event) => { const button = event.target.closest("[data-save-total]"); if (button) saveTotal(button.closest("tr")).catch((error) => setStatus(error.message, "error")); });
handsBody?.addEventListener("click", (event) => { const button = event.target.closest("[data-release]"); if (button) releaseCard(button.closest("tr"), button.dataset.release).catch((error) => setStatus(error.message, "error")); });
