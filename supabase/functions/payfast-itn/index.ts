import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const responseHeaders = { "Content-Type": "text/plain" };

const getPlanUpdate = (plan: string) => {
  if (plan === "subscribe_now") {
    return {
      status: "active",
      registration_fee_paid: true,
      registration_fee_amount: 30,
      subscription_fee_amount: 100,
      payment_plan: "subscribe_now",
      trial_booking_limit: 0,
      trial_booking_used: 0,
      trial_started_at: null,
      activated_at: new Date().toISOString(),
    };
  }

  if (plan === "subscription_only") {
    return {
      status: "active",
      registration_fee_paid: true,
      subscription_fee_amount: 100,
      activated_at: new Date().toISOString(),
    };
  }

  return {
    status: "trial",
    registration_fee_paid: true,
    registration_fee_amount: 70,
    subscription_fee_amount: 100,
    payment_plan: "trial_then_sub",
    trial_booking_limit: 5,
    trial_booking_used: 0,
    trial_started_at: new Date().toISOString(),
    activated_at: null,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("METHOD_NOT_ALLOWED", { status: 405, headers: responseHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const raw = await req.text();
    const form = new URLSearchParams(raw);
    const paymentStatus = String(form.get("payment_status") || "").toUpperCase();
    const paymentRef = String(form.get("m_payment_id") || "");
    const payfastPaymentId = String(form.get("pf_payment_id") || "");

    if (!paymentRef) return new Response("MISSING_REF", { status: 400, headers: responseHeaders });

    const { data: paymentRow, error: paymentErr } = await supabase
      .from("barber_subscription_payments")
      .select("barber_id, plan, amount, status")
      .eq("payment_ref", paymentRef)
      .maybeSingle();

    if (paymentErr || !paymentRow) return new Response("UNKNOWN_PAYMENT", { status: 404, headers: responseHeaders });

    if (paymentStatus !== "COMPLETE") {
      await supabase
        .from("barber_subscription_payments")
        .update({
          status: paymentStatus === "FAILED" ? "failed" : "cancelled",
          raw_payload: Object.fromEntries(form.entries()),
        })
        .eq("payment_ref", paymentRef);
      return new Response("IGNORED", { status: 200, headers: responseHeaders });
    }

    await supabase
      .from("barber_subscription_payments")
      .update({
        status: "complete",
        payfast_payment_id: payfastPaymentId || null,
        paid_at: new Date().toISOString(),
        raw_payload: Object.fromEntries(form.entries()),
      })
      .eq("payment_ref", paymentRef);

    const updateData = {
      barber_id: paymentRow.barber_id,
      ...getPlanUpdate(paymentRow.plan),
    };

    const { error: subErr } = await supabase
      .from("barber_subscription_state")
      .upsert(updateData, { onConflict: "barber_id" });
    if (subErr) throw subErr;

    return new Response("OK", { status: 200, headers: responseHeaders });
  } catch (error) {
    console.error("PayFast ITN error:", error);
    return new Response("ERROR", { status: 500, headers: responseHeaders });
  }
});
