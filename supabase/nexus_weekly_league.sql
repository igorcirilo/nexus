-- NEXUS — Liga semanal persistida
-- Executar no SQL Editor do Supabase

create table if not exists public.weekly_league_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  xp integer not null default 0,
  tier text not null check (tier in ('Bronze','Prata','Ouro','Lenda')),
  username text not null default 'Guerreiro',
  level integer not null default 1,
  title text not null default 'Recruta',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_league_snapshots_week_start_idx
  on public.weekly_league_snapshots (week_start, xp desc, updated_at asc);

create index if not exists weekly_league_snapshots_user_idx
  on public.weekly_league_snapshots (user_id, week_start desc);

alter table public.weekly_league_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_league_snapshots'
      and policyname = 'weekly league select authenticated'
  ) then
    create policy "weekly league select authenticated"
      on public.weekly_league_snapshots
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_league_snapshots'
      and policyname = 'weekly league insert own'
  ) then
    create policy "weekly league insert own"
      on public.weekly_league_snapshots
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_league_snapshots'
      and policyname = 'weekly league update own'
  ) then
    create policy "weekly league update own"
      on public.weekly_league_snapshots
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
