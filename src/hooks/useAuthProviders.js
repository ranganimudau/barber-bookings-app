import { useEffect, useState } from "react";
import { supabaseAnonKey, supabaseUrl } from "../supabase/supabaseClient";

/**
 * Which external auth providers the Supabase project actually has enabled.
 *
 * Read at runtime from the public /auth/v1/settings endpoint rather than
 * hard-coded, so the Google button appears by itself the moment Google is
 * switched on in the dashboard — and, more importantly, stays hidden until
 * then instead of being a button that errors when tapped.
 *
 * Fails closed: any network/parse problem leaves providers off, so the
 * worst case is email sign-in only, never a broken button.
 */
export function useAuthProviders() {
  const [providers, setProviders] = useState({ google: false });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: supabaseAnonKey },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setProviders({ google: !!json?.external?.google });
      } catch {
        if (!cancelled) setProviders({ google: false });
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, checked };
}
