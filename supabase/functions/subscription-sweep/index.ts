import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Daily sweep (pg_cron): locks shops whose trial ended with no active
// subscription, locks shops whose 3-day renewal grace period elapsed, and
// sends an in-app push nudge to barbers currently in grace.
//
// SMS nudges from the spec are intentionally not implemented here — this
// codebase has no SMS provider wired in yet (Twilio/etc.). Add one before
// enabling that part of the spec.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const GRACE_DAYS = 3;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date();
    const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1. Trial ended, never subscribed -> lock.
    const { data: trialExpired, error: trialErr } = await supabase
      .from("barber_subscription_state")
      .update({ shop_status: "locked" })
      .eq("shop_status", "active")
      .eq("subscription_status", "none")
      .lt("trial_end", now.toISOString())
      .select("barber_id");
    if (trialErr) throw trialErr;

    // 2. Grace period elapsed -> lock, mark subscription cancelled.
    const { data: graceExpired, error: graceErr } = await supabase
      .from("barber_subscription_state")
      .update({ shop_status: "locked", subscription_status: "cancelled" })
      .eq("subscription_status", "grace")
      .lt("grace_started_at", graceCutoff)
      .select("barber_id");
    if (graceErr) throw graceErr;

    // 2b. Self-serve cancellation reached its paid-through date -> lock.
    // The PayFast token was already stopped when the barber cancelled, so
    // no charge is attempted here — this only flips the DB state.
    const { data: cancelExpired, error: cancelErr } = await supabase
      .from("barber_subscription_state")
      .update({ shop_status: "locked", subscription_status: "none" })
      .eq("subscription_status", "active")
      .eq("cancel_at_period_end", true)
      .lt("subscription_renews_at", now.toISOString())
      .select("barber_id");
    if (cancelErr) throw cancelErr;

    // 3. Still within grace -> nudge.
    const { data: inGrace, error: inGraceErr } = await supabase
      .from("barber_subscription_state")
      .select("barber_id, grace_started_at")
      .eq("subscription_status", "grace")
      .gte("grace_started_at", graceCutoff);
    if (inGraceErr) throw inGraceErr;

    let nudged = 0;
    for (const row of inGrace || []) {
      const { data: tokenRows } = await supabase
        .from("user_push_tokens")
        .select("token")
        .eq("user_id", row.barber_id);
      const tokens = (tokenRows || []).map((r: any) => r.token).filter(Boolean);
      if (tokens.length === 0) continue;

      const daysLeft = Math.max(
        0,
        GRACE_DAYS - Math.floor((now.getTime() - new Date(row.grace_started_at).getTime()) / (24 * 60 * 60 * 1000)),
      );

      const messages = tokens.map((token: string) => ({
        to: token,
        sound: "default",
        title: "Subscription renewal failed",
        body: `Your R70 renewal didn't go through. Pay now or your shop locks in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        data: { type: "SUBSCRIPTION_GRACE" },
      }));

      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (resp.ok) nudged += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        locked_trial_expired: (trialExpired || []).length,
        locked_grace_expired: (graceExpired || []).length,
        locked_cancel_expired: (cancelExpired || []).length,
        nudged,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("subscription-sweep error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
