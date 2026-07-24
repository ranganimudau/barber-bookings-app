import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "https://esm.sh/js-md5@0.8.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// PHP-style urlencode to match PayFast's own signing — same rule as the
// checkout/ITN signatures elsewhere in this project (spaces -> "+", plus a
// few extra percent-encoded characters encodeURIComponent leaves alone).
const encode = (value: string) =>
  encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// PayFast's Recurring Billing (REST) API signs differently from the
// payment-form/ITN flow: every field (headers here, since there's no query
// or body for a cancel call) plus the passphrase is sorted alphabetically
// by key, not passphrase-appended-last. See PayFast's own PHP SDK
// (lib/Auth.php::generateApiSignature) for the reference implementation.
function apiSignature(fields: Record<string, string>, passphrase?: string) {
  const data: Record<string, string> = { ...fields };
  if (passphrase) data.passphrase = passphrase;
  const paramString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${encode(data[k])}`)
    .join("&");
  return md5(paramString);
}

// PHP's date("Y-m-d\TH:i:sO") — ISO8601 with a signed 4-digit offset, no
// colon. We always sign in UTC to sidestep any server-timezone ambiguity.
function pfTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0000`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: authError?.message || "Sign in again and retry." }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: state, error: stateErr } = await supabaseAdmin
      .from("barber_subscription_state")
      .select("subscription_status, payfast_token, cancel_at_period_end, subscription_renews_at")
      .eq("barber_id", user.id)
      .maybeSingle();
    if (stateErr) throw stateErr;

    if (!state || state.subscription_status !== "active") {
      return new Response(JSON.stringify({ error: "No active subscription to cancel" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (state.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ ok: true, already_cancelled: true, subscription_renews_at: state.subscription_renews_at }),
        { status: 200, headers: jsonHeaders },
      );
    }

    if (!state.payfast_token) {
      return new Response(
        JSON.stringify({ error: "No recurring billing token on file. Contact support to cancel this subscription." }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE");
    const sandbox = (Deno.env.get("PAYFAST_SANDBOX") || "false").toLowerCase() === "true";
    if (!merchantId) {
      return new Response(JSON.stringify({ error: "PayFast environment not configured" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const headerFields = { "merchant-id": merchantId, version: "v1", timestamp: pfTimestamp() };
    const signature = apiSignature(headerFields, passphrase);

    const cancelUrl = `https://api.payfast.co.za/subscriptions/${state.payfast_token}/cancel${sandbox ? "?testing=true" : ""}`;
    const pfRes = await fetch(cancelUrl, {
      method: "PUT",
      headers: { ...headerFields, signature },
    });
    const pfText = await pfRes.text();

    // A 404 here most likely means the token is already cancelled/expired
    // on PayFast's side — treat that as success so a stale token can't
    // block the barber from cancelling in our own records.
    if (!pfRes.ok && pfRes.status !== 404) {
      console.error("PayFast cancel-subscription failed:", pfRes.status, pfText);
      return new Response(JSON.stringify({ error: "Could not cancel with PayFast", detail: pfText }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("barber_subscription_state")
      .update({ cancel_at_period_end: true })
      .eq("barber_id", user.id);
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ ok: true, subscription_renews_at: state.subscription_renews_at }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("cancel-payfast-subscription error:", error);
    return new Response(JSON.stringify({ error: "Cancel failed", detail: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
