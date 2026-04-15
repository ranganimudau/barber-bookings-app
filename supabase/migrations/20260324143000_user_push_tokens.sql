-- Stores Expo push tokens per user/device for server-side notifications.

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  device_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_user_push_tokens_user_id
  on public.user_push_tokens(user_id);

create or replace function public.set_user_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_push_tokens_updated_at on public.user_push_tokens;
create trigger trg_user_push_tokens_updated_at
before update on public.user_push_tokens
for each row execute function public.set_user_push_tokens_updated_at();

alter table public.user_push_tokens enable row level security;

drop policy if exists "Users can manage own push tokens" on public.user_push_tokens;
create policy "Users can manage own push tokens"
on public.user_push_tokens
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
