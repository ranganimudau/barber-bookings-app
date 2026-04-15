import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AppointmentRecord {
  id?: string;
  barber_id?: string;
  client_id?: string;
  appointment_date?: string;
  appointment_time?: string;
  service_name?: string;
  status?: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: AppointmentRecord;
  old_record?: AppointmentRecord;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const isConfirmedStatus = (status?: string) =>
  ["confirmed", "accepted", "approved"].includes((status || "").toLowerCase());

const isCancelledStatus = (status?: string) =>
  ["cancelled", "declined", "rejected"].includes((status || "").toLowerCase());

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const payload: WebhookPayload & { event?: string } = await req.json();
    const table = (payload.table || "").toLowerCase();
    if (table !== "appointments" || !payload.record?.barber_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "not appointment payload" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const type = String(payload.type || payload.event || "").toUpperCase();
    const record = payload.record;
    const oldRecord = payload.old_record || {};
    const barberId = record.barber_id;
    const clientId = record.client_id;
    let targetUserIds: string[] = [barberId].filter(Boolean);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const timeRaw = record.appointment_time != null ? String(record.appointment_time) : "";
    const time = timeRaw.substring(0, 5);
    const date =
      record.appointment_date != null ? String(record.appointment_date).slice(0, 10) : "";
    const service = record.service_name || "Appointment";

    let title = "";
    let body = "";

    if (type === "INSERT") {
      title = "New Booking Request";
      body = `${service} requested for ${date} at ${time}.`;
    } else if (type === "UPDATE") {
      const prevStatus = (oldRecord.status || "").toLowerCase();
      const nextStatus = (record.status || "").toLowerCase();
      if (prevStatus === nextStatus) {
        return new Response(JSON.stringify({ ok: true, skipped: "status unchanged" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (isCancelledStatus(nextStatus)) {
        // Barber declined -> notify the client.
        targetUserIds = [(clientId || barberId)].filter(Boolean);
        title = "Booking Cancelled";
        body = `${service} on ${date} at ${time} was cancelled.`;
      } else if (isConfirmedStatus(nextStatus)) {
        // Confirmation -> notify the client.
        targetUserIds = [(clientId || barberId)].filter(Boolean);
        title = "Booking Confirmed";
        body = `${service} on ${date} at ${time} is confirmed.`;

        // Create a server-side reminder for the client (30 minutes before start).
        // Cron will later send the actual push even if the app is fully closed.
        if (clientId && date && timeRaw) {
          const bookingAt = new Date(`${date}T${timeRaw.substring(0, 5)}:00`);
          const reminderAt = new Date(bookingAt.getTime() - 30 * 60 * 1000);

          if (!Number.isNaN(reminderAt.getTime())) {
            await supabase.from("appointment_reminders").upsert(
              {
                appointment_id: record.id,
                user_id: clientId,
                reminder_at: reminderAt.toISOString(),
              },
              { onConflict: "appointment_id" }
            );
          }
        }
      } else {
        return new Response(JSON.stringify({ ok: true, skipped: "unsupported status transition" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ ok: true, skipped: "unsupported event type" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    if (tokenError) {
      throw tokenError;
    }

    const tokens = Array.from(new Set((tokenRows || []).map((row) => row.token).filter(Boolean)));
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no tokens for target users" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: {
        appointment_id: record.id,
        barber_id: barberId,
        client_id: clientId,
        target_user_ids: targetUserIds,
        target_user_id: targetUserIds[0] ?? null,
        type,
      },
    }));

    const pushResp = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const pushJson = await pushResp.json();
    return new Response(JSON.stringify({ ok: pushResp.ok, response: pushJson }), {
      status: pushResp.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
