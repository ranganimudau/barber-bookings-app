-- Daily cron: lock shops whose trial/grace period has elapsed (see
-- supabase/functions/subscription-sweep). Reuses the project_url/anon_key
-- vault secrets already created in 20260325104000_appointment_reminders_cron.sql.

select cron.schedule(
  'subscription-sweep-daily',
  '0 2 * * *', -- 02:00 UTC daily
  $$
  select net.http_post(
    url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/subscription-sweep',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);
