import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase/supabaseClient";

const REFRESH_SESSION_MS = 10000;

/**
 * Refreshes session when possible; never blocks longer than REFRESH_SESSION_MS (refreshSession can hang on poor networks).
 */
async function getAccessToken() {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();

  if (!initial?.access_token) {
    throw new Error("Not signed in. Please log in again.");
  }

  const refreshRace = Promise.race([
    supabase.auth.refreshSession(),
    new Promise((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: { message: "__timeout__" } }), REFRESH_SESSION_MS)
    ),
  ]);

  const { data: refreshed, error: refreshErr } = await refreshRace;
  const session = refreshed?.session ?? initial;
  const accessToken = session?.access_token;

  if (refreshErr?.message === "__timeout__") {
    if (__DEV__) {
      console.warn("[checkout] refreshSession timed out; using cached access token");
    }
    return initial.access_token;
  }

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

  return accessToken;
}

function enrichPayfastKeyHint(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("payfast environment not configured")) {
    return `${message} In Supabase: Project Settings → Edge Functions → Secrets, set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY from your PayFast dashboard.`;
  }
  return message;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function createPayfastCheckout({ plan }) {
  const callCheckout = (token) =>
    fetchWithTimeout(`${supabaseUrl}/functions/v1/create-payfast-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ plan }),
    });

  let accessToken = await getAccessToken();
  let res = await callCheckout(accessToken);

  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const next = refreshed?.session?.access_token;
    if (next) {
      accessToken = next;
      res = await callCheckout(accessToken);
    }
  }

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
    throw new Error(enrichPayfastKeyHint(msg));
  }

  const paymentUrl = json.payment_url;
  if (!paymentUrl) {
    throw new Error("Payment link not available");
  }

  return { ...json, payment_url: paymentUrl };
}
