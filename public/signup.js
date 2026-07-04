import { getSession, getSupabaseClient } from "./auth.js";

const form = document.querySelector("#signup-form");
const emailEl = document.querySelector("#signup-email");
const displayNameEl = document.querySelector("#signup-display-name");
const passwordEl = document.querySelector("#signup-password");
const confirmEl = document.querySelector("#signup-password-confirm");
const statusEl = document.querySelector("#signup-status");

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

try {
  const session = await getSession();
  if (session) {
    setStatus("You are already logged in.");
  }
} catch (error) {
  setStatus(error.message, "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (passwordEl.value !== confirmEl.value) {
    setStatus("Passwords do not match.", "error");
    return;
  }

  setStatus("Creating account...");

  try {
    const supabase = await getSupabaseClient();
    const email = emailEl.value.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: passwordEl.value,
      options: {
        data: {
          display_name: displayNameEl.value.trim(),
          username: email
        }
      }
    });

    if (error) throw error;

    const userId = data.user?.id;
    if (userId) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: userId,
          email,
          display_name: displayNameEl.value.trim(),
          username: email
        }, { onConflict: "user_id" });

      if (profileError) {
        setStatus(`Account created. Log in once after confirming your email so we can finish your profile. User UUID: ${userId}`);
        return;
      }
    }

    setStatus(userId
      ? `Account created. Send this user UUID to the Commissioner: ${userId}`
      : "Account created. Check your email to confirm your login.");
  } catch (error) {
    setStatus(error.message, "error");
  }
});
