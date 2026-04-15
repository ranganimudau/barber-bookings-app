/**
 * Parses Supabase auth redirect URLs: tokens may appear in the hash or query string.
 * Merges hash + query when both carry params (unlikely but safe).
 */
export function parseSupabaseAuthParams(url) {
  if (!url || typeof url !== "string") return {};
  try {
    const merge = (a, b) => ({ ...b, ...a });

    const hashIdx = url.indexOf("#");
    const qIdx = url.indexOf("?");

    let fromHash = {};
    let fromQuery = {};

    if (hashIdx >= 0) {
      const raw = url.slice(hashIdx + 1).split("&").filter(Boolean).join("&");
      if (raw) fromHash = Object.fromEntries(new URLSearchParams(raw));
    }
    if (qIdx >= 0) {
      const end = hashIdx >= 0 ? hashIdx : url.length;
      const raw = url.slice(qIdx + 1, end).split("&").filter(Boolean).join("&");
      if (raw) fromQuery = Object.fromEntries(new URLSearchParams(raw));
    }

    const merged = merge(fromHash, fromQuery);
    return Object.keys(merged).length ? merged : {};
  } catch {
    return {};
  }
}

/** True for implicit (tokens) or PKCE (code) recovery redirects from our app. */
export function shouldOpenPasswordRecovery(url, params) {
  if (!url || !params) return false;
  const pathRecovery =
    /reset-password/i.test(url) ||
    /auth\/reset-password/i.test(url) ||
    /\/--\/auth\/reset-password/i.test(url);

  const hasCode = Boolean(params.code);
  const hasTokens = Boolean(params.access_token && params.refresh_token);
  const typedRecovery = params.type === "recovery";

  if (!hasCode && !hasTokens) return false;
  if (typedRecovery || pathRecovery) return true;
  return false;
}
