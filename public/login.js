import { getSession, getSupabaseClient } from "./auth.js";

const form = document.querySelector("#login-form");
const emailEl = document.querySelector("#login-email");
const passwordEl = document.querySelector("#login-password");
const statusEl = document.querySelector("#login-status");
const params = new URLSearchParams(window.location.search);
const nextUrl = params.get("next") || "/admin.html";

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

async function refreshProfile(supabase) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.id || !user.email) return;

  await supabase
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || null,
      username: user.email
    }, { onConflict: "user_id" });
}

try {
  const session = await getSession();
  if (session) {
    window.location.assign(nextUrl);
  }
} catch (error) {
  setStatus(error.message, "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Signing in...");

  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value
    });

    if (error) {
      throw error;
    }

    await refreshProfile(supabase);
    window.location.assign(nextUrl);
  } catch (error) {
    setStatus(error.message, "error");
  }
});
