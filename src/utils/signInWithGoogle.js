import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabase/supabaseClient";

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
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL("auth/callback");

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

  if (result.type !== "success" || !result.url) {
    return { ok: false, cancelled: true };
  }

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

  // Provider or Supabase rejected it — surface the reason instead of a
  // generic failure.
  const errorDescription = readParam(url, "error_description") || readParam(url, "error");
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));

  const accessToken = readParam(url, "access_token");
  const refreshToken = readParam(url, "refresh_token");
  const code = readParam(url, "code");

  const key = code || accessToken;
  if (!key) return { ok: false };
  if (handledCallbacks.has(key)) return { ok: true, alreadyHandled: true };
  handledCallbacks.add(key);

  try {
    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw new Error(sessionError.message);
      return { ok: true };
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw new Error(exchangeError.message);
    return { ok: true };
  } catch (e) {
    // Let a genuine failure be retried rather than silently swallowed.
    handledCallbacks.delete(key);
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
