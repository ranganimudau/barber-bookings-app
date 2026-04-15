-- Enables server-side delivery of 30-minute client reminders using pg_cron.

-- Extensions required for invoking Edge Functions over HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store credentials in Supabase Vault (used by cron job to invoke the Edge Function)
-- Note: anon key is public; still stored in Vault for consistent invocation pattern.
select vault.create_secret(
  'https://lrafqfmpxpjkvqfeabxx.supabase.co',
  'project_url'
);
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyYWZxZm1weHBqa3ZxZmVhYnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDA0MTMsImV4cCI6MjA4NjA3NjQxM30.efVQqMhzPyRdo_onNsrVK9PG84GOxAfmTACqhVEZw4c',
  'anon_key'
);

-- Schedule: run every minute
select cron.schedule(
  'send-appointment-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-appointment-reminders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

