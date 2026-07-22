import { supabase } from "../supabase/supabaseClient";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 3;

const daysUntil = (isoDate) => {
  if (!isoDate) return 0;
  const ms = Date.parse(isoDate) - Date.now();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.ceil(ms / DAY_MS));
};

export async function fetchBarberSubscriptionState(barberId) {
  if (!barberId) return null;
  try {
    const { data, error } = await supabase
      .from("barber_subscription_state")
      .select("*")
      .eq("barber_id", barberId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (e) {
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("could not find the table") || msg.includes("relation") || msg.includes("does not exist")) {
      // Migration not applied yet (or pointed at a different Supabase project).
      return null;
    }
    throw e;
  }
}

export async function ensureBarberSubscriptionState(barberId) {
  if (!barberId) return null;
  try {
    let state = await fetchBarberSubscriptionState(barberId);
    if (!state) {
      const { data } = await supabase
        .from("barber_subscription_state")
        .upsert(
          {
            barber_id: barberId,
            shop_status: "locked",
            subscription_status: "none",
          },
          { onConflict: "barber_id" }
        )
        .select("*")
        .maybeSingle();

      state = data || null;
    }
    return state;
  } catch (e) {
    // If migration not applied yet, swallow.
    return null;
  }
}

/** Days left in the 20-day trial window (0 once it's over or not in a trial). */
export function getTrialDaysRemaining(state) {
  if (!state) return 0;
  if (state.subscription_status && state.subscription_status !== "none") return 0;
  return daysUntil(state.trial_end);
}

export function isSubscriptionEligible(state) {
  return state?.shop_status === "active";
}

export function getSubscriptionLabel(state) {
  if (!state) return "Locked";

  if (state.shop_status === "locked") {
    if (state.subscription_status === "cancelled") return "Subscription cancelled — pay R70 to reactivate";
    if (state.trial_end) return "Trial ended — subscribe to continue";
    return "Registration required";
  }

  if (state.subscription_status === "grace") {
    const elapsedDays = state.grace_started_at
      ? Math.floor((Date.now() - Date.parse(state.grace_started_at)) / DAY_MS)
      : 0;
    const daysLeft = Math.max(0, GRACE_DAYS - elapsedDays);
    return `Renewal failed — pay within ${daysLeft} day${daysLeft === 1 ? "" : "s"} to avoid lock`;
  }

  if (state.subscription_status === "active") {
    const daysLeft = daysUntil(state.subscription_renews_at);
    return `Active subscription — renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  }

  const trialDaysLeft = getTrialDaysRemaining(state);
  return `Trial (${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left)`;
}
