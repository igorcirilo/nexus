-- ─────────────────────────────────────────────────────────────────────────
-- Quit Habits v1 — rastreio de maus hábitos a largar ("dias sem recair").
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo: cria duas
-- tabelas novas com RLS por utilizador, não toca em dados existentes.
--
--   quit_habits     → o vício/hábito que se quer largar (1 linha por hábito)
--   quit_relapses   → histórico de recaídas (para estatísticas e melhor streak)
--
-- "Dias limpo" = hoje − quit_date. Ao recair, guardamos a melhor sequência em
-- best_streak, registamos a recaída e reiniciamos quit_date para hoje.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.quit_habits (
  id          uuid not null default gen_random_uuid(),
  user_id     uuid not null,
  name        text not null,
  area        text,
  motivation  text,
  quit_date   date not null default current_date,
  best_streak integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint quit_habits_pkey primary key (id),
  constraint quit_habits_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade
);

create table if not exists public.quit_relapses (
  id            uuid not null default gen_random_uuid(),
  user_id       uuid not null,
  quit_habit_id uuid not null,
  date          date not null default current_date,
  note          text,
  created_at    timestamptz not null default now(),
  constraint quit_relapses_pkey primary key (id),
  constraint quit_relapses_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint quit_relapses_habit_fkey foreign key (quit_habit_id) references public.quit_habits(id) on delete cascade
);

create index if not exists quit_habits_user_idx on public.quit_habits (user_id);
create index if not exists quit_relapses_habit_idx on public.quit_relapses (quit_habit_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.quit_habits enable row level security;
alter table public.quit_relapses enable row level security;

create policy quit_habits_select_own on public.quit_habits for select using (auth.uid() = user_id);
create policy quit_habits_insert_own on public.quit_habits for insert with check (auth.uid() = user_id);
create policy quit_habits_update_own on public.quit_habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy quit_habits_delete_own on public.quit_habits for delete using (auth.uid() = user_id);

create policy quit_relapses_select_own on public.quit_relapses for select using (auth.uid() = user_id);
create policy quit_relapses_insert_own on public.quit_relapses for insert with check (auth.uid() = user_id);
create policy quit_relapses_delete_own on public.quit_relapses for delete using (auth.uid() = user_id);
