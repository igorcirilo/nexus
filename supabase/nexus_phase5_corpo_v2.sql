-- Fase 5 — Corpo V2: acompanhamento diário
-- Executar depois do SQL anterior de agenda/transações

create table if not exists public.training_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_plan_id uuid not null references public.training_plans(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  notes text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists training_entries_unique_day
  on public.training_entries (user_id, training_plan_id, date);

create index if not exists training_entries_user_date_idx
  on public.training_entries (user_id, date desc);

alter table public.training_entries enable row level security;

do $$ begin
  create policy "training_entries_select_own" on public.training_entries
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "training_entries_insert_own" on public.training_entries
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "training_entries_update_own" on public.training_entries
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "training_entries_delete_own" on public.training_entries
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diet_plan_id uuid not null references public.diet_plans(id) on delete cascade,
  date date not null,
  meal_key text not null check (meal_key in ('pequeno_almoco','almoco','jantar','lanche')),
  completed boolean not null default false,
  notes text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists diet_meals_unique_day
  on public.diet_meals (user_id, diet_plan_id, date, meal_key);

create index if not exists diet_meals_user_date_idx
  on public.diet_meals (user_id, date desc);

alter table public.diet_meals enable row level security;

do $$ begin
  create policy "diet_meals_select_own" on public.diet_meals
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "diet_meals_insert_own" on public.diet_meals
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "diet_meals_update_own" on public.diet_meals
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "diet_meals_delete_own" on public.diet_meals
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
