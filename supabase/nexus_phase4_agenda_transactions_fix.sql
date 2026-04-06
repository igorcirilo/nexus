-- Build + agenda fix support
-- 1) Garantir agenda_events e policies corretas
create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  date date not null,
  time text null,
  end_time text null,
  color text not null default '#E8A838',
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agenda_events enable row level security;

do $$ begin
  create policy "agenda_events_select_own" on public.agenda_events
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agenda_events_insert_own" on public.agenda_events
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agenda_events_update_own" on public.agenda_events
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "agenda_events_delete_own" on public.agenda_events
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists agenda_events_user_date_idx on public.agenda_events (user_id, date);

-- 2) Garantir transactions para importação bulk
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('entrada','saida')),
  category text not null,
  description text null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

do $$ begin
  create policy "transactions_select_own" on public.transactions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_insert_own" on public.transactions
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_update_own" on public.transactions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "transactions_delete_own" on public.transactions
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
