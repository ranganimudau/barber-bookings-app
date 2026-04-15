// Supabase Edge Function: send barber an email when a new appointment is created.
// Trigger: Database Webhook on INSERT into public.appointments
// Secrets: RESEND_API_KEY (required). Optionally set FROM_EMAIL and FROM_NAME.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API = "https://api.resend.com/emails";

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    barber_id?: string;
    client_id?: string;
    appointment_date?: string;
    appointment_time?: string;
    service_name?: string;
    price?: number;
    status?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const payload: WebhookPayload = await req.json();
    if (payload.type !== "INSERT" || payload.table !== "appointments" || !payload.record) {
      return new Response(JSON.stringify({ ok: true, skipped: "not an appointment insert" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = payload.record;
    const barberId = record.barber_id;
    const clientId = record.client_id;

    if (!barberId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no barber_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", [barberId, clientId].filter(Boolean));

    const barber = profiles?.find((p) => p.id === barberId);
    const client = profiles?.find((p) => p.id === clientId);
    const barberEmail = barber?.email;
    const clientName = client?.full_name || "A client";

    if (!barberEmail) {
      console.warn("Barber has no email in profiles, skipping notification:", barberId);
      return new Response(JSON.stringify({ ok: true, skipped: "no barber email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY is not set");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fromEmail = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
    const fromName = Deno.env.get("FROM_NAME") || "Barber Bookings";
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const timeStr = record.appointment_time ? String(record.appointment_time).substring(0, 5) : "";
    const dateStr = record.appointment_date || "";
    const serviceStr = record.service_name || "Service";
    const priceStr = record.price != null ? `R${record.price}` : "";

    const subject = "New appointment request – " + dateStr + " at " + timeStr;
    const html = `
      <h2>New appointment request</h2>
      <p><strong>${clientName}</strong> has requested an appointment.</p>
      <ul>
        <li><strong>Date:</strong> ${dateStr}</li>
        <li><strong>Time:</strong> ${timeStr}</li>
        <li><strong>Service:</strong> ${serviceStr} ${priceStr ? `(${priceStr})` : ""}</li>
      </ul>
      <p>Open your Barber app to confirm or decline the request.</p>
    `;

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [barberEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", res.status, errText);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resData = await res.json();
    return new Response(JSON.stringify({ ok: true, emailId: resData?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
