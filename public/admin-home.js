import { requireSession, signOut } from "./auth.js";

const statusEl = document.querySelector("#admin-home-status");
const logoutButton = document.querySelector("#logout-button");

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

try {
  const session = await requireSession();
  setStatus(`Logged in as ${session?.user?.email || "admin"}.`);
} catch (error) {
  setStatus(error.message, "error");
}

logoutButton.addEventListener("click", signOut);
