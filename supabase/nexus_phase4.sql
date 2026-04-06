-- FASE 4 + fix agenda

create extension if not exists pgcrypto;

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  date date not null,
  time time null,
  end_time time null,
  color text not null default '#E8A838',
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agenda_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agenda_events' and policyname = 'agenda_events_select_own'
  ) then
    create policy agenda_events_select_own on public.agenda_events
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agenda_events' and policyname = 'agenda_events_insert_own'
  ) then
    create policy agenda_events_insert_own on public.agenda_events
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agenda_events' and policyname = 'agenda_events_update_own'
  ) then
    create policy agenda_events_update_own on public.agenda_events
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agenda_events' and policyname = 'agenda_events_delete_own'
  ) then
    create policy agenda_events_delete_own on public.agenda_events
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('pdf', 'spreadsheet')),
  source_file_name text null,
  summary text null,
  raw_content jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('pdf', 'spreadsheet')),
  source_file_name text null,
  summary text null,
  raw_content jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.training_plans enable row level security;
alter table public.diet_plans enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_plans' and policyname = 'training_plans_select_own') then
    create policy training_plans_select_own on public.training_plans
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_plans' and policyname = 'training_plans_insert_own') then
    create policy training_plans_insert_own on public.training_plans
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_plans' and policyname = 'training_plans_update_own') then
    create policy training_plans_update_own on public.training_plans
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_plans' and policyname = 'training_plans_delete_own') then
    create policy training_plans_delete_own on public.training_plans
      for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'diet_plans' and policyname = 'diet_plans_select_own') then
    create policy diet_plans_select_own on public.diet_plans
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'diet_plans' and policyname = 'diet_plans_insert_own') then
    create policy diet_plans_insert_own on public.diet_plans
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'diet_plans' and policyname = 'diet_plans_update_own') then
    create policy diet_plans_update_own on public.diet_plans
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'diet_plans' and policyname = 'diet_plans_delete_own') then
    create policy diet_plans_delete_own on public.diet_plans
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists agenda_events_user_date_idx on public.agenda_events(user_id, date);
create index if not exists training_plans_user_created_idx on public.training_plans(user_id, created_at desc);
create index if not exists diet_plans_user_created_idx on public.diet_plans(user_id, created_at desc);
