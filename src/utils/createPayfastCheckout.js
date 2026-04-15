import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase/supabaseClient";

/**
 * Calls create-payfast-checkout with fetch so non-2xx bodies (error + detail) surface in the UI.
 * Refreshes the session first — a stale cached access_token causes Edge gateway "Invalid JWT" (401).
 */
export async function createPayfastCheckout({ plan }) {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();

  if (!initial) {
    throw new Error("Not signed in. Please log in again.");
  }

  // Always refresh when possible — getSession() may omit refresh_token in JS, but refreshSession() reads storage.
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  const session = refreshed?.session ?? initial;
  const accessToken = session?.access_token;

  if (refreshErr && !accessToken) {
    throw new Error(
      /invalid refresh token/i.test(String(refreshErr.message || ""))
        ? "Session expired. Please sign out and sign in again."
        : refreshErr.message || "Could not refresh your session. Please sign in again."
    );
  }

  if (!accessToken) {
    throw new Error("Not signed in. Please log in again.");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/create-payfast-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ plan }),
  });

  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    // leave json empty
  }

  if (!res.ok) {
    const gatewayMsg = json.message && typeof json.message === "string" ? json.message : null;
    const parts = [json.error, json.detail, json.hint, gatewayMsg].filter(Boolean);
    const msg = parts.length ? parts.join(" — ") : text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (!json.payment_url) {
    throw new Error("Payment link not available");
  }

  return json;
}
