import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReminderRow {
  id?: string;
  appointment_id?: string;
  user_id?: string;
  reminder_at?: string;
  sent_at?: string | null;
}

interface AppointmentRow {
  id?: string;
  client_id?: string;
  service_name?: string;
  appointment_date?: string;
  appointment_time?: string;
}

interface CronPayload {
  time?: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const toHHMM = (t?: string) => (t || "00:00").substring(0, 5);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const body: CronPayload = await req.json().catch(() => ({} as CronPayload));
    const now = body?.time ? new Date(body.time) : new Date();
    if (Number.isNaN(now.getTime())) return new Response("bad time", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch due reminders that haven't been sent yet
    const { data: dueReminders, error: dueErr } = await supabase
      .from("appointment_reminders")
      .select("id, appointment_id, user_id, reminder_at")
      .is("sent_at", null)
      .lte("reminder_at", now.toISOString())
      .limit(25);

    if (dueErr) throw dueErr;
    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no due reminders" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    for (const reminder of dueReminders as ReminderRow[]) {
      const appointmentId = reminder.appointment_id;
      const userId = reminder.user_id;
      if (!appointmentId || !userId) continue;

      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, client_id, service_name, appointment_date, appointment_time")
        .eq("id", appointmentId)
        .maybeSingle();

      if (!appointment) {
        // Appointment deleted; mark as sent to avoid retry loops.
        await supabase
          .from("appointment_reminders")
          .update({ sent_at: now.toISOString() })
          .eq("appointment_id", appointmentId);
        continue;
      }

      const clientId = appointment.client_id || userId;
      const { data: tokenRows, error: tokenErr } = await supabase
        .from("user_push_tokens")
        .select("token")
        .eq("user_id", clientId);

      if (tokenErr) throw tokenErr;
      const tokens = (tokenRows || []).map((r: any) => r.token).filter(Boolean);

      const time = toHHMM(appointment.appointment_time);
      const service = appointment.service_name || "Appointment";

      const title = "Appointment Reminder";
      const bodyText = `${service} starts at ${time}.`;

      if (tokens.length > 0) {
        const messages = tokens.map((token: string) => ({
          to: token,
          sound: "default",
          title,
          body: bodyText,
          data: {
            appointment_id: appointmentId,
            type: "REMINDER",
          },
        }));

        const pushResp = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messages),
        });

        const pushJson = await pushResp.json();
        if (pushResp.ok) {
          await supabase
            .from("appointment_reminders")
            .update({ sent_at: now.toISOString() })
            .eq("appointment_id", appointmentId);
        } else {
          console.warn("Expo push failed (will retry next cron):", pushJson);
        }
      } else {
        // No device token: mark as sent so we don't retry forever.
        await supabase
          .from("appointment_reminders")
          .update({ sent_at: now.toISOString() })
          .eq("appointment_id", appointmentId);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: dueReminders.length }), {
      status: 200,
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

