import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabase/supabaseClient";

export const OAUTH_TRACE_KEY = "oauth_debug_trace";

/**
 * App.js registers here so a completed OAuth exchange can push the new
 * session into React state directly.
 *
 * Relying on onAuthStateChange or an AppState transition proved unreliable:
 * the auth browser is a Custom Tab in the same task, so the app often never
 * goes inactive, and the session ended up sitting on disk with the UI still
 * showing the login screen until the next cold start.
 */
let sessionEstablishedHandler = null;

export function setSessionEstablishedHandler(fn) {
  sessionEstablishedHandler = fn;
}

/**
 * Diagnostics have to survive the process being restarted — Android hands
 * the barberapp:// callback to a fresh activity, which tears down any
 * in-memory state or pending alert before it can be read.
 */
// Held in memory and rewritten whole. The previous read-append-write raced
// with itself on rapid successive calls, so lines were being lost — which
// is exactly what made the last trace ambiguous.
let traceLines = [];

export function resetOAuthTrace() {
  traceLines = [];
}

export async function traceOAuth(line) {
  try {
    traceLines.push(`${new Date().toISOString().slice(11, 19)} ${line}`);
    await AsyncStorage.setItem(OAUTH_TRACE_KEY, traceLines.join("\n"));
  } catch {
    /* diagnostics must never break sign-in */
  }
}

/**
 * Google sign-in via Supabase OAuth, opened in the system auth browser and
 * returned to the app through the barberapp:// scheme.
 *
 * Supabase hands the session back in one of two shapes depending on the
 * project's configured flow — tokens in the URL fragment (implicit) or a
 * short-lived code to exchange (PKCE) — so both are handled rather than
 * assuming one and breaking if the setting ever changes.
 *
 * Resolves { ok: true } once a session is set (the app's onAuthStateChange
 * listener takes it from there), { ok: false, cancelled: true } if the user
 * backed out, or throws with a readable message.
 */
export async function signInWithGoogle({ onDiagnostic } = {}) {
  const redirectTo = Linking.createURL("auth/callback");
  const report = (stage, detail) => {
    onDiagnostic?.(`${stage}: ${detail}`);
    traceOAuth(`${stage}: ${detail}`);
  };
  resetOAuthTrace();
  report("redirectTo", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // We drive the browser ourselves so we can await the redirect back.
      skipBrowserRedirect: true,
      // Ask Google to show the picker rather than silently reusing the last
      // account — people often have more than one signed in.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error("Could not start Google sign-in. Please try again.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  report("browser result", result?.type || "unknown");

  if (result.type !== "success" || !result.url) {
    // The deep-link listener in App.js may still complete this — Android
    // often routes the callback through the scheme instead.
    return { ok: false, cancelled: true, browserResult: result?.type };
  }

  report("returned url", String(result.url).slice(0, 120));
  return completeOAuthFromUrl(result.url);
}

// A given auth code is single-use — exchanging it twice fails. Both the
// WebBrowser result and the deep-link listener can see the same callback
// (Android often opens the app via the barberapp:// scheme before
// openAuthSessionAsync resolves), so remember what's been handled and let
// whichever arrives first win.
const handledCallbacks = new Set();

/**
 * Turns a barberapp://auth/callback URL into a session. Safe to call from
 * more than one place with the same URL.
 */
export async function completeOAuthFromUrl(url) {
  if (!url) return { ok: false };
  traceOAuth(`callback seen: ${String(url).slice(0, 140)}`);

  // Provider or Supabase rejected it — surface the reason instead of a
  // generic failure.
  const errorDescription = readParam(url, "error_description") || readParam(url, "error");
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));

  const accessToken = readParam(url, "access_token");
  const refreshToken = readParam(url, "refresh_token");
  const code = readParam(url, "code");

  const key = code || accessToken;
  if (!key) {
    await traceOAuth("no code or tokens in callback");
    return { ok: false };
  }
  if (handledCallbacks.has(key)) {
    await traceOAuth("already handled (duplicate callback)");
    return { ok: true, alreadyHandled: true };
  }
  handledCallbacks.add(key);
  await traceOAuth(`handling ${code ? "code" : "tokens"}`);

  try {
    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw new Error(sessionError.message);
      return { ok: true };
    }

    // exchangeCodeForSession can hang indefinitely right as the app resumes
    // from the browser hand-off — the same class of bug already worked
    // around elsewhere in this codebase for auth.getUser()/getSession()
    // (see SubscriptionPaywall.js, createPayfastCheckout.js). There it was
    // fixed by racing a timeout and moving on; here we actually need the
    // result, so retry once — the hang has consistently been a transient
    // resume-window issue, not a real failure, everywhere else it's shown up.
    const attemptExchange = async (attemptNumber) => {
      await traceOAuth(`exchanging code… (attempt ${attemptNumber})`);
      return Promise.race([
        supabase.auth.exchangeCodeForSession(code),
        new Promise((resolve) => setTimeout(() => resolve({ __timedOut: true }), 8000)),
      ]);
    };

    let exchange = await attemptExchange(1);
    if (exchange?.__timedOut) {
      await traceOAuth("attempt 1 timed out after 8s, retrying…");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      exchange = await attemptExchange(2);
    }

    if (exchange?.error) {
      // Codes are single-use. If attempt 1 actually reached the server
      // before we gave up on it client-side, attempt 2 reusing the same
      // code fails with exactly this kind of error — which really means
      // attempt 1 succeeded. Check for a real session before calling it a
      // failure.
      await traceOAuth(`exchange error: ${exchange.error.message} — checking for a session anyway`);
      const { data: existing } = await supabase.auth.getSession();
      if (existing?.session) {
        await traceOAuth("session found despite exchange error (attempt 1 had succeeded)");
        exchange = { data: existing };
      } else {
        throw new Error(exchange.error.message);
      }
    }

    if (exchange?.__timedOut) throw new Error("Code exchange timed out twice — please try again.");

    await traceOAuth(`session established: ${exchange?.data?.session ? "yes" : "no session in response"}`);

    // Push it into the app directly — see setSessionEstablishedHandler.
    try {
      await sessionEstablishedHandler?.();
      await traceOAuth("app notified of session");
    } catch (notifyError) {
      await traceOAuth(`notify failed: ${notifyError?.message}`);
    }

    return { ok: true };
  } catch (e) {
    // Let a genuine failure be retried rather than silently swallowed.
    handledCallbacks.delete(key);
    await traceOAuth(`FAILED: ${e?.message}`);
    throw e;
  }
}

/** True for a Supabase auth redirect that isn't password recovery. */
export function isOAuthCallbackUrl(params) {
  if (!params) return false;
  if (params.type === "recovery") return false;
  return Boolean(params.code || (params.access_token && params.refresh_token));
}

/** Pulls a param whether it arrived in the query string or the fragment. */
function readParam(url, key) {
  const match = url.match(new RegExp(`[?&#]${key}=([^&#]+)`));
  return match ? match[1] : null;
}
