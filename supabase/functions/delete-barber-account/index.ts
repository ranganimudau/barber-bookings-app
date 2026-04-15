import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Permanently deletes a barber account: business data + profile + auth user.
 * Requires a valid JWT; profile.role must be `barber` or a `barbers` row must exist.
 */
Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delete-barber-account] unhandled:", msg);
    return new Response(JSON.stringify({ error: "unhandled", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the user from the same JWT the app sends (anon client + Authorization header).
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  let uid: string | undefined;
  if (anonKey) {
    const scoped = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await scoped.auth.getUser();
    if (userErr || !user?.id) {
      return new Response(
        JSON.stringify({ error: "invalid_token", detail: userErr?.message || "getUser failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    uid = user.id;
  } else {
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user?.id) {
      return new Response(
        JSON.stringify({ error: "invalid_token", detail: userErr?.message || "getUser failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    uid = user.id;
  }

  if (!uid) {
    return new Response(JSON.stringify({ error: "invalid_token", detail: "No user id" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  if (profileErr) {
    return new Response(JSON.stringify({ error: "profile_lookup_failed", detail: profileErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: barberRow } = await admin.from("barbers").select("id").eq("id", uid).maybeSingle();
  const role = String(profile?.role ?? "").toLowerCase().trim();
  const isBarber = role === "barber" || !!barberRow;

  if (!isBarber) {
    return new Response(
      JSON.stringify({
        error: "not_a_barber",
        detail: "Profile role is not barber and no barber record was found.",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  /** Best-effort deletes. Missing tables (PGRST205) are ignored. */
  const ignorable = (msg: string) => {
    const m = msg.toLowerCase();
    return (
      m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find the table")
    );
  };

  const mustDelete = async (
    table: string,
    filter: { column: string; value: string },
  ) => {
    const { error } = await admin.from(table).delete().eq(filter.column, filter.value);
    if (!error) return;
    if (ignorable(error.message || "")) return;
    throw new Error(`${table}: ${error.code ?? ""} ${error.message}`.trim());
  };

  try {
    // Optional: some projects use only `appointments`; `bookings` may be absent or legacy.
    try {
      await mustDelete("bookings", { column: "barber_id", value: uid });
    } catch (bErr) {
      console.warn("[delete-barber-account] bookings skipped:", bErr);
    }
    // As barber and/or client: remove all appointments involving this user (frees ratings, reminders FKs).
    await mustDelete("appointments", { column: "client_id", value: uid });
    await mustDelete("appointments", { column: "barber_id", value: uid });
    await mustDelete("barber_availability", { column: "barber_id", value: uid });
    await mustDelete("barber_services", { column: "barber_id", value: uid });
    await mustDelete("barber_subscription_state", { column: "barber_id", value: uid });
    await mustDelete("user_push_tokens", { column: "user_id", value: uid });
    await mustDelete("barbers", { column: "id", value: uid });
    await mustDelete("profiles", { column: "id", value: uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "delete_data_failed", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(uid);
  if (delAuthErr) {
    return new Response(
      JSON.stringify({ error: "auth_delete_failed", detail: delAuthErr.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
