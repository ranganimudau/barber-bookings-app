import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "https://esm.sh/js-md5@0.8.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Plan = "trial" | "subscription";

const PLAN_CONFIG: Record<Plan, { amount: number; itemName: string; recurring: boolean }> = {
  trial: { amount: 50, itemName: "Shop unlock — 20 day trial", recurring: false },
  subscription: { amount: 70, itemName: "Barber Monthly Subscription", recurring: true },
};

// PayFast's signature is generated PHP-style (urlencode): spaces become "+"
// and a handful of extra characters get percent-encoded that
// encodeURIComponent leaves alone. Must match exactly or PayFast rejects
// with "Generated signature does not match submitted signature".
const encode = (value: string | number) =>
  encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

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
    const plan = String(body?.plan || "trial") as Plan;
    if (!PLAN_CONFIG[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payfastMerchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const payfastMerchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const payfastPassphrase = Deno.env.get("PAYFAST_PASSPHRASE");

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
    const config = PLAN_CONFIG[plan];

    const { error: insertErr } = await supabaseAdmin.from("barber_subscription_payments").insert({
      payment_ref: paymentRef,
      barber_id: user.id,
      plan,
      amount: config.amount,
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
      amount: config.amount.toFixed(2),
      item_name: config.itemName,
      custom_str1: plan,
      custom_str2: user.id,
    };

    // R70/month recurring billing — PayFast auto-charges the card every
    // cycle and fires payfast-itn again for each renewal. Requires
    // recurring billing to be enabled on the merchant account; PayFast
    // rejects the checkout with an error if it isn't.
    if (config.recurring) {
      values.subscription_type = "1";
      values.billing_date = new Date().toISOString().slice(0, 10);
      values.recurring_amount = config.amount.toFixed(2);
      values.frequency = "3"; // monthly
      values.cycles = "0"; // indefinite, until cancelled
    }

    // PayFast signature: MD5 of the parameter string (in the order added
    // above), passphrase appended if configured. Required once a
    // passphrase is set on the merchant account.
    if (payfastPassphrase) {
      const sigSource =
        Object.entries(values)
          .map(([k, v]) => `${k}=${encode(v)}`)
          .join("&") + `&passphrase=${encode(payfastPassphrase)}`;
      values.signature = md5(sigSource);
    }

    const query = Object.entries(values)
      .map(([k, v]) => `${k}=${encode(v)}`)
      .join("&");

    const sandbox = (Deno.env.get("PAYFAST_SANDBOX") || "false").toLowerCase() === "true";
    const host = sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
    const paymentUrl = `${host}?${query}`;

    return new Response(JSON.stringify({ payment_ref: paymentRef, payment_url: paymentUrl, amount: config.amount, plan }), {
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
