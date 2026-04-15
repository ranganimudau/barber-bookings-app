import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Plan = "trial_then_sub" | "subscribe_now" | "subscription_only";

const PLAN_CONFIG: Record<Plan, { amount: number; itemName: string }> = {
  trial_then_sub: { amount: 70, itemName: "Barber Registration Fee (5 free bookings plan)" },
  subscribe_now: { amount: 130, itemName: "Barber Registration + Subscription" },
  subscription_only: { amount: 100, itemName: "Barber Monthly Subscription" },
};

const encode = (value: string | number) => encodeURIComponent(String(value));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    // Use anon key + caller JWT for auth.getUser(). Service role + user JWT often fails getUser() in Edge Functions.
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          detail: authError?.message || "Sign in again and retry.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "trial_then_sub") as Plan;
    if (!PLAN_CONFIG[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payfastMerchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const payfastMerchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");

    // PayFast only accepts http(s) return/cancel URLs — not custom schemes like barberapp://
    const projectBase = (Deno.env.get("SUPABASE_URL") || Deno.env.get("APP_PUBLIC_URL") || "").replace(/\/$/, "");
    if (!projectBase) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL for PayFast return URLs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const itnUrl = `${projectBase}/functions/v1/payfast-itn`;
    const defaultReturnUrl = `${projectBase}/functions/v1/payfast-app-return?next=success`;
    const defaultCancelUrl = `${projectBase}/functions/v1/payfast-app-return?next=cancel`;

    const pickHttpUrl = (envKey: string, fallback: string) => {
      const raw = Deno.env.get(envKey)?.trim();
      if (raw && /^https?:\/\//i.test(raw)) return raw;
      return fallback;
    };
    const returnUrl = pickHttpUrl("PAYFAST_RETURN_URL", defaultReturnUrl);
    const cancelUrl = pickHttpUrl("PAYFAST_CANCEL_URL", defaultCancelUrl);

    if (!payfastMerchantId || !payfastMerchantKey) {
      return new Response(JSON.stringify({ error: "PayFast environment not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentRef = `${plan}-${user.id}-${Date.now()}`;
    const amount = PLAN_CONFIG[plan].amount;

    const { error: insertErr } = await supabaseAdmin.from("barber_subscription_payments").insert({
      payment_ref: paymentRef,
      barber_id: user.id,
      plan,
      amount,
      status: "pending",
    });
    if (insertErr) {
      return new Response(
        JSON.stringify({
          error: "Could not start payment",
          detail: insertErr.message,
          hint:
            insertErr.code === "23503"
              ? "Barber profile row missing. Finish shop setup so your account exists in barbers."
              : undefined,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const values: Record<string, string> = {
      merchant_id: payfastMerchantId,
      merchant_key: payfastMerchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: itnUrl,
      name_first: user.user_metadata?.full_name || "Barber",
      email_address: user.email || "barber@example.com",
      m_payment_id: paymentRef,
      amount: amount.toFixed(2),
      item_name: PLAN_CONFIG[plan].itemName,
      custom_str1: plan,
      custom_str2: user.id,
    };

    const query = Object.entries(values)
      .map(([k, v]) => `${k}=${encode(v)}`)
      .join("&");

    const sandbox = (Deno.env.get("PAYFAST_SANDBOX") || "false").toLowerCase() === "true";
    const host = sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
    const paymentUrl = `${host}?${query}`;

    return new Response(JSON.stringify({ payment_ref: paymentRef, payment_url: paymentUrl, amount, plan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Checkout failed", detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
