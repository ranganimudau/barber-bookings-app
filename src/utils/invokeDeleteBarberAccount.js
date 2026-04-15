import { supabase, supabaseAnonKey, supabaseUrl } from "../supabase/supabaseClient";

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * Calls delete-barber-account via fetch so we always read JSON error bodies.
 * Uses a hard timeout so the UI never spins forever (refreshSession can hang on RN).
 */
export async function invokeDeleteBarberAccount() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (sessionError || !session?.access_token) {
    return {
      ok: false,
      message: "You are not signed in or your session expired. Log in again and retry.",
    };
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/delete-barber-account`;
  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      60000
    );
  } catch (e) {
    const name = e?.name || "";
    const aborted = name === "AbortError" || String(e?.message || "").includes("aborted");
    return {
      ok: false,
      message: aborted
        ? "Request timed out. Check your internet connection and try again."
        : e?.message || "Network error.",
    };
  }

  const raw = await res.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    if (body?.detail) {
      return { ok: false, message: `${body.error || "Error"}: ${body.detail}` };
    }
    if (body?.message && typeof body.message === "string") {
      return { ok: false, message: `${body.code ?? res.status}: ${body.message}` };
    }
    if (body?.error) {
      return { ok: false, message: String(body.error) };
    }
    return {
      ok: false,
      message: `Request failed (${res.status}). ${raw ? raw.slice(0, 240) : "Empty response"}`,
    };
  }

  if (body?.error) {
    return {
      ok: false,
      message: body.detail ? `${body.error}: ${body.detail}` : String(body.error),
    };
  }

  return { ok: true };
}
