import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "https://esm.sh/js-md5@0.8.3";

const responseHeaders = { "Content-Type": "text/plain" };

const addDaysIso = (days: number, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

// PHP-style urlencode to match how PayFast generates its own signature —
// see create-payfast-checkout/index.ts for the same encoding, required there too.
const pfEncode = (value: string) =>
  encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

const verifySignature = (form: URLSearchParams, passphrase: string | undefined) => {
  if (!passphrase) return true; // no passphrase configured — skip validation (dev/sandbox)
  const received = form.get("signature");
  if (!received) return false;

  const parts: string[] = [];
  for (const [key, value] of form.entries()) {
    if (key === "signature") continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  const sigSource = `${parts.join("&")}&passphrase=${pfEncode(passphrase)}`;
  return md5(sigSource) === received;
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

    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE");
    if (!verifySignature(form, passphrase)) {
      console.error("PayFast ITN signature mismatch");
      return new Response("INVALID_SIGNATURE", { status: 400, headers: responseHeaders });
    }

    const paymentStatus = String(form.get("payment_status") || "").toUpperCase();
    const paymentRef = String(form.get("m_payment_id") || "");
    const payfastPaymentId = String(form.get("pf_payment_id") || "");
    const token = form.get("token") || null;
    const amountGross = Number(form.get("amount_gross") || form.get("amount") || 0) || null;
    const rawPayload = Object.fromEntries(form.entries());

    // First-time payment: we created this payment_ref ourselves at checkout.
    const { data: paymentRow } = paymentRef
      ? await supabase
          .from("barber_subscription_payments")
          .select("barber_id, plan, amount, status")
          .eq("payment_ref", paymentRef)
          .maybeSingle()
      : { data: null };

    if (paymentRow) {
      await supabase
        .from("barber_subscription_payments")
        .update({
          status: paymentStatus === "COMPLETE" ? "complete" : paymentStatus === "FAILED" ? "failed" : "cancelled",
          payfast_payment_id: payfastPaymentId || null,
          paid_at: paymentStatus === "COMPLETE" ? new Date().toISOString() : null,
          raw_payload: rawPayload,
        })
        .eq("payment_ref", paymentRef);

      if (paymentStatus !== "COMPLETE") {
        return new Response("IGNORED", { status: 200, headers: responseHeaders });
      }

      if (paymentRow.plan === "trial") {
        const startedAt = new Date().toISOString();
        await supabase
          .from("barber_subscription_state")
          .upsert(
            {
              barber_id: paymentRow.barber_id,
              shop_status: "active",
              trial_start: startedAt,
              trial_end: addDaysIso(20, new Date(startedAt)),
            },
            { onConflict: "barber_id" },
          );
      } else {
        // First subscription payment (or a resubscribe after a prior
        // cancellation) — unlock immediately, start a fresh 30-day cycle,
        // and clear any pending cancellation from a previous subscription.
        await supabase
          .from("barber_subscription_state")
          .upsert(
            {
              barber_id: paymentRow.barber_id,
              shop_status: "active",
              subscription_status: "active",
              subscription_renews_at: addDaysIso(30),
              grace_started_at: null,
              payfast_token: token,
              cancel_at_period_end: false,
            },
            { onConflict: "barber_id" },
          );
      }

      return new Response("OK", { status: 200, headers: responseHeaders });
    }

    // No matching payment_ref — this is a recurring renewal charge PayFast
    // triggered on its own schedule, identified by the subscription token.
    if (token) {
      const { data: subRow } = await supabase
        .from("barber_subscription_state")
        .select("barber_id, grace_started_at")
        .eq("payfast_token", token)
        .maybeSingle();

      if (!subRow) {
        console.error("PayFast ITN: unknown subscription token", token);
        return new Response("UNKNOWN_TOKEN", { status: 404, headers: responseHeaders });
      }

      const renewalRef = `renewal-${subRow.barber_id}-${Date.now()}`;
      await supabase.from("barber_subscription_payments").insert({
        payment_ref: renewalRef,
        barber_id: subRow.barber_id,
        plan: "subscription",
        amount: amountGross ?? 70,
        status: paymentStatus === "COMPLETE" ? "complete" : "failed",
        payfast_payment_id: payfastPaymentId || null,
        paid_at: paymentStatus === "COMPLETE" ? new Date().toISOString() : null,
        raw_payload: rawPayload,
      });

      if (paymentStatus === "COMPLETE") {
        await supabase
          .from("barber_subscription_state")
          .update({
            shop_status: "active",
            subscription_status: "active",
            subscription_renews_at: addDaysIso(30),
            grace_started_at: null,
          })
          .eq("barber_id", subRow.barber_id);
      } else {
        // Renewal failed — 3-day grace period at current unlocked status.
        // subscription-sweep locks the shop once the grace window elapses.
        await supabase
          .from("barber_subscription_state")
          .update({
            subscription_status: "grace",
            grace_started_at: subRow.grace_started_at ?? new Date().toISOString(),
          })
          .eq("barber_id", subRow.barber_id);
      }

      return new Response("OK", { status: 200, headers: responseHeaders });
    }

    return new Response("UNKNOWN_PAYMENT", { status: 404, headers: responseHeaders });
  } catch (error) {
    console.error("PayFast ITN error:", error);
    return new Response("ERROR", { status: 500, headers: responseHeaders });
  }
});
