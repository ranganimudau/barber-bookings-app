import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase/supabaseClient";

const REFRESH_SESSION_MS = 10000;

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function cancelPayfastSubscription() {
  const callCancel = (token) =>
    fetchWithTimeout(`${supabaseUrl}/functions/v1/cancel-payfast-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({}),
    });

  let accessToken = await getAccessToken();
  let res = await callCancel(accessToken);

  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const next = refreshed?.session?.access_token;
    if (next) {
      accessToken = next;
      res = await callCancel(accessToken);
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
    const parts = [json.error, json.detail].filter(Boolean);
    throw new Error(parts.length ? parts.join(" — ") : text || `HTTP ${res.status}`);
  }

  return json;
}
