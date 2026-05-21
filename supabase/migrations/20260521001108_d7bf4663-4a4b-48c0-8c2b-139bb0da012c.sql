
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android','ios','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

create policy "users read own device tokens" on public.device_tokens for select using (auth.uid() = user_id);
create policy "users insert own device tokens" on public.device_tokens for insert with check (auth.uid() = user_id);
create policy "users update own device tokens" on public.device_tokens for update using (auth.uid() = user_id);
create policy "users delete own device tokens" on public.device_tokens for delete using (auth.uid() = user_id);

create trigger device_tokens_updated_at before update on public.device_tokens for each row execute function public.update_updated_at_column();
