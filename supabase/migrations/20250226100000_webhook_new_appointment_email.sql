-- Database Webhook: notify barber by email on new appointment
--
-- Supabase does not create this trigger via SQL on hosted projects.
-- You must create the webhook in the Dashboard:
--
--   1. Database → Webhooks → Create a new hook
--   2. Table: appointments
--   3. Events: Insert
--   4. Type: Supabase Edge Functions → send-new-appointment-email
--
-- Then deploy the Edge Function and set RESEND_API_KEY (see
-- supabase/functions/send-new-appointment-email/README.md).

-- Optional: If your project uses pg_net and you prefer a trigger,
-- you can try the following (adjust PROJECT_REF and SERVICE_ROLE_KEY).
-- Uncomment and run only if Database Webhooks are not available.
/*
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_barber_new_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  url text := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-new-appointment-email';
  key text := 'YOUR_SERVICE_ROLE_KEY';
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', NULL
  );
  PERFORM net.http_post(
    url,
    payload::text,
    '{"Content-Type": "application/json", "Authorization": "Bearer ' || key || '"}'::jsonb,
    '1000'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_created_notify_barber ON public.appointments;
CREATE TRIGGER on_appointment_created_notify_barber
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_barber_new_appointment();
*/
