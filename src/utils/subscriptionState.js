import { supabase } from "../supabase/supabaseClient";

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
    const existing = await fetchBarberSubscriptionState(barberId);
    if (existing) return existing;

    const { data } = await supabase
      .from("barber_subscription_state")
      .upsert(
        {
          barber_id: barberId,
          status: "inactive",
          trial_booking_limit: 5,
          trial_booking_used: 0,
          registration_fee_paid: false,
          registration_fee_amount: 0,
          subscription_fee_amount: 100,
          payment_plan: null,
          activated_at: null,
        },
        { onConflict: "barber_id" }
      )
      .select("*")
      .maybeSingle();

    return data || null;
  } catch (e) {
    // If migration not applied yet, swallow.
    return null;
  }
}

export function getTrialRemaining(state) {
  if (!state) return 0;
  if (state.status !== "trial") return 0;
  const limit = Number(state.trial_booking_limit ?? 0) || 0;
  const used = Number(state.trial_booking_used ?? 0) || 0;
  return Math.max(0, limit - used);
}

export function isSubscriptionEligible(state) {
  if (!state) return false;
  if (state.status === "active") return true;
  if (state.status === "trial") return getTrialRemaining(state) > 0;
  return false;
}

export function getSubscriptionLabel(state) {
  if (!state) return "Locked";
  if (state.status === "active") return "Active Subscription";
  if (state.status === "trial") {
    const remaining = getTrialRemaining(state);
    return remaining > 0 ? `Trial (${remaining} booking${remaining === 1 ? "" : "s"} left)` : "Trial exhausted";
  }
  if (!state.registration_fee_paid) return "Registration fee required";
  return "Subscription required";
}

