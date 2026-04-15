-- Stores server-side scheduled reminders for appointment starts.

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- client receiving the reminder
  reminder_at timestamptz not null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointment_reminders_user_id on public.appointment_reminders(user_id);
create index if not exists idx_appointment_reminders_reminder_at on public.appointment_reminders(reminder_at);
create index if not exists idx_appointment_reminders_sent_at on public.appointment_reminders(sent_at);

create or replace function public.set_appointment_reminders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appointment_reminders_updated_at on public.appointment_reminders;
create trigger trg_appointment_reminders_updated_at
before update on public.appointment_reminders
for each row execute function public.set_appointment_reminders_updated_at();

alter table public.appointment_reminders enable row level security;

-- Users may read their own reminder rows (optional; service role uses bypass anyway)
drop policy if exists "Users can read own reminders" on public.appointment_reminders;
create policy "Users can read own reminders"
on public.appointment_reminders
for select
using (auth.uid() = user_id);

