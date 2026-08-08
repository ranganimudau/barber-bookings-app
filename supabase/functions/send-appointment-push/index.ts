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
  ["cancelled", "declined", "rejected", "no_show"].includes((status || "").toLowerCase());

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
    // Which profiles.notify_* switch governs this message, if any. A new
    // booking request has no switch — it's the barber's core workflow, not
    // something they should be able to silently miss.
    let prefColumn: string | null = null;

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

      if (nextStatus === "expired") {
        // Swept by the hourly expire_stale_pending_appointments cron: the
        // business never answered and the slot has passed. The client is
        // the one left hanging, so they're the one who gets told.
        targetUserIds = [clientId].filter(Boolean);
        prefColumn = "notify_booking_declined";
        title = "Booking Expired";
        body = `${service} on ${date} at ${time} wasn't answered in time. Try booking again.`;
      } else if (isCancelledStatus(nextStatus)) {
        prefColumn = "notify_booking_declined";
        if (nextStatus === "declined" || nextStatus === "rejected") {
          // Barber-initiated -> tell the client.
          targetUserIds = [(clientId || barberId)].filter(Boolean);
          title = "Booking Declined";
          body = `${service} on ${date} at ${time} wasn't accepted. Try another time or business.`;
        } else if (nextStatus === "no_show") {
          // Barber-initiated -> tell the client.
          targetUserIds = [(clientId || barberId)].filter(Boolean);
          title = "Marked as no-show";
          body = `${service} on ${date} at ${time} was marked as a no-show.`;
        } else {
          // A plain cancellation can come from either side — most often the
          // client, including when they delete their account. Notifying only
          // the client meant the business was never told its slot had freed
          // up and kept holding it for nobody. Tell both; whoever pressed
          // cancel gets a harmless confirmation, and nobody is left guessing.
          targetUserIds = [clientId, barberId].filter(Boolean);
          title = "Booking Cancelled";
          body = `${service} on ${date} at ${time} was cancelled.`;
        }
      } else if (isConfirmedStatus(nextStatus)) {
        // Confirmation -> notify the client.
        targetUserIds = [(clientId || barberId)].filter(Boolean);
        prefColumn = "notify_booking_confirmed";
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

    // Honour the recipient's notification switches (Settings → Notifications).
    // A row that's missing or has no explicit false still gets the push —
    // failing open matches the columns' default and avoids silently
    // swallowing notifications for anyone created before this shipped.
    if (prefColumn && targetUserIds.length > 0) {
      const { data: prefRows, error: prefError } = await supabase
        .from("profiles")
        .select(`id, ${prefColumn}`)
        .in("id", targetUserIds);

      if (prefError) throw prefError;

      const optedOut = new Set(
        (prefRows || [])
          .filter((row: Record<string, unknown>) => row[prefColumn] === false)
          .map((row: Record<string, unknown>) => row.id as string),
      );
      targetUserIds = targetUserIds.filter((id) => !optedOut.has(id));

      if (targetUserIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: "all recipients opted out" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
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
