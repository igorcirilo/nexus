-- ============================================================================
-- NEXUS — schema_completo.sql
-- ----------------------------------------------------------------------------
-- DUMP FIEL do schema REAL do projeto Supabase de produção
-- (projeto jsslyritdivjtsiwdorm), extraído via catálogos do Postgres.
-- Use este ficheiro para recriar a base de dados num projeto NOVO/vazio.
--
-- Inclui as 31 tabelas existentes, constraints, índices, RLS (75 policies),
-- as funções (add_xp, update_streak, handle_new_user, rls_auto_enable) e os
-- triggers. NÃO contém dados — apenas estrutura.
--
-- Nota: goal_milestones estava em falta no banco e foi criada (migration
--       add_goal_milestones); a sua DDL está incluída no fim deste ficheiro.
--
-- Ordem: extensões → tabelas → constraints → índices → RLS → policies →
--        funções → triggers.
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists "uuid-ossp";    -- uuid_generate_v4()

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELAS (apenas colunas; constraints/índices/RLS adicionados depois)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid not null,
  username text,
  created_at timestamptz default now(),
  xp_total integer default 0,
  level integer default 1,
  title text default 'Recruta',
  streak_current integer default 0,
  streak_best integer default 0,
  streak_last_date date,
  mission_today text,
  energy_today integer default 5,
  onboarded boolean default false,
  fin_current_savings numeric(12,2) default 0, -- legada: a reserva passou a ser derivada (ver fin_savings_base)
  -- Poupança fora do histórico registado (saldo inicial + ajustes manuais).
  -- Reserva mostrada = fin_savings_base + Σ líquido das transações "Poupança"
  -- (migration financas_reserva_v1.sql).
  fin_savings_base numeric(12,2) default 0,
  fin_monthly_save numeric(10,2),
  fin_reserve_goal numeric(10,2),
  last_login_bonus date,
  streak_freeze_used_week text,
  program_id uuid,
  initial_score integer,
  current_score integer,
  onboarding_version integer default 1,
  -- alinhadas com a interface Profile / página de perfil (migration profiles_align_missing_columns)
  age integer,
  sex text,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  goal_weight numeric(6,2),
  water_goal_ml integer,
  workouts_per_week integer,
  sleep_goal_h numeric(4,1),
  read_pages_day integer,
  fin_debt_goal numeric(12,2),
  goal_90_personal text,
  goal_90_career text,
  goal_90_health text,
  xp_weekly_goal integer,
  completion_pct_goal integer
);

create table if not exists public.badges (
  id uuid not null default uuid_generate_v4(),
  key text not null,
  name text not null,
  description text,
  icon text,
  xp_reward integer default 100
);

create table if not exists public.user_assessments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  version integer default 2,
  responses jsonb not null,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.life_area_scores (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  assessment_id uuid,
  area text not null,
  score integer not null,
  snapshot_at timestamptz default now()
);

create table if not exists public.programs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  assessment_id uuid,
  status text default 'active',
  started_at date not null,
  ends_at date not null,
  created_at timestamptz default now()
);

create table if not exists public.program_weeks (
  id uuid not null default gen_random_uuid(),
  program_id uuid,
  week_number integer not null,
  theme text,
  starts_on date not null,
  created_at timestamptz default now()
);

create table if not exists public.program_days (
  id uuid not null default gen_random_uuid(),
  program_id uuid,
  week_id uuid,
  day_number integer not null,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists public.task_templates (
  id uuid not null default gen_random_uuid(),
  area text not null,
  title text not null,
  description text,
  difficulty integer default 1,
  frequency_per_week integer default 7,
  xp_reward integer default 20,
  tags text[],
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.program_tasks (
  id uuid not null default gen_random_uuid(),
  program_id uuid,
  day_id uuid,
  user_id uuid not null,
  template_id uuid,
  title text not null,
  description text,
  area text not null,
  difficulty integer default 1,
  xp_reward integer default 20,
  status text default 'pending',
  source text default 'generated',
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.habits (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  name text not null,
  area text not null,
  xp_reward integer default 20,
  time_window text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.habit_logs (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  habit_id uuid,
  date date not null default current_date,
  completed boolean default false,
  completed_at timestamptz
);

create table if not exists public.checkins (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  date date not null default current_date,
  phase text not null,
  sleep_hours numeric(3,1),
  energy integer,
  mood integer,
  mission text,
  will_train boolean,
  progress_pct integer,
  focus_level text,
  next_action text,
  mission_done text,
  win_of_day text,
  reflection text,
  xp_earned integer default 0,
  completed_at timestamptz default now()
);

create table if not exists public.focus_sessions (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  date date not null default current_date,
  duration integer not null,
  task text,
  xp_earned integer default 30,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  date date not null default current_date,
  type text not null,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  -- Despesa paga pela reserva ("paga-te primeiro"): saída de categoria real que
  -- sai da reserva, não da conta corrente (migration financas_gasto_reserva_v1).
  from_reserve boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.goals_90 (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  title text not null,
  area text not null,
  start_date date not null default current_date,
  end_date date not null,
  progress integer default 0,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  "time" text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  days text[] default '{}',
  type text default 'custom',
  description text
);

create table if not exists public.agenda_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  date date not null,
  "time" time,
  end_time time,
  color text not null default '#E8A838',
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid not null default uuid_generate_v4(),
  user_id uuid,
  badge_key text,
  earned_at timestamptz default now()
);

create table if not exists public.weekly_challenges (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  week_end date not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_league_snapshots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  week_end date not null,
  points integer not null default 0,
  tier text not null,
  username text not null default 'Guerreiro',
  level integer not null default 1,
  title text not null default 'Recruta',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.training_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  source_type text not null,
  source_file_name text,
  summary text,
  raw_content jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.training_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  training_plan_id uuid not null,
  date date not null,
  completed boolean not null default false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  source_type text not null,
  source_file_name text,
  summary text,
  raw_content jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_meals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  diet_plan_id uuid not null,
  date date not null,
  meal_key text not null,
  completed boolean not null default false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  author text,
  source_file_name text,
  cover_label text,
  raw_content jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.book_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null,
  current_page integer not null default 1,
  progress_pct numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.book_highlights (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  color text not null default '#E8A838',
  excerpt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.book_notes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  note text not null,
  excerpt text,
  created_at timestamptz not null default now()
);

create table if not exists public.book_bookmarks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_preferences (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  theme text not null default 'sepia',
  reading_mode text not null default 'scroll',
  font_scale numeric(4,2) not null default 1,
  line_height numeric(4,2) not null default 1.7,
  margin_px integer not null default 20,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSTRAINTS (PK / UNIQUE / FK / CHECK)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_program_id_fkey foreign key (program_id) references programs(id);

alter table public.badges add constraint badges_pkey primary key (id);
alter table public.badges add constraint badges_key_key unique (key);

alter table public.user_assessments add constraint user_assessments_pkey primary key (id);
alter table public.user_assessments add constraint user_assessments_user_id_fkey foreign key (user_id) references auth.users(id);

alter table public.life_area_scores add constraint life_area_scores_pkey primary key (id);
alter table public.life_area_scores add constraint life_area_scores_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.life_area_scores add constraint life_area_scores_assessment_id_fkey foreign key (assessment_id) references user_assessments(id) on delete cascade;

alter table public.programs add constraint programs_pkey primary key (id);
alter table public.programs add constraint programs_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.programs add constraint programs_assessment_id_fkey foreign key (assessment_id) references user_assessments(id);

alter table public.program_weeks add constraint program_weeks_pkey primary key (id);
alter table public.program_weeks add constraint program_weeks_program_id_fkey foreign key (program_id) references programs(id) on delete cascade;

alter table public.program_days add constraint program_days_pkey primary key (id);
alter table public.program_days add constraint program_days_program_id_fkey foreign key (program_id) references programs(id) on delete cascade;
alter table public.program_days add constraint program_days_week_id_fkey foreign key (week_id) references program_weeks(id) on delete cascade;

alter table public.task_templates add constraint task_templates_pkey primary key (id);

alter table public.program_tasks add constraint program_tasks_pkey primary key (id);
alter table public.program_tasks add constraint program_tasks_program_id_fkey foreign key (program_id) references programs(id) on delete cascade;
alter table public.program_tasks add constraint program_tasks_day_id_fkey foreign key (day_id) references program_days(id) on delete cascade;
alter table public.program_tasks add constraint program_tasks_template_id_fkey foreign key (template_id) references task_templates(id);
alter table public.program_tasks add constraint program_tasks_user_id_fkey foreign key (user_id) references auth.users(id);

alter table public.habits add constraint habits_pkey primary key (id);
alter table public.habits add constraint habits_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table public.habit_logs add constraint habit_logs_pkey primary key (id);
alter table public.habit_logs add constraint habit_logs_user_id_habit_id_date_key unique (user_id, habit_id, date);
alter table public.habit_logs add constraint habit_logs_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.habit_logs add constraint habit_logs_habit_id_fkey foreign key (habit_id) references habits(id) on delete cascade;

alter table public.checkins add constraint checkins_pkey primary key (id);
alter table public.checkins add constraint checkins_user_id_date_phase_key unique (user_id, date, phase);
alter table public.checkins add constraint checkins_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.checkins add constraint checkins_phase_check check (phase = any (array['manha','tarde','noite']));
alter table public.checkins add constraint checkins_energy_check check (energy >= 1 and energy <= 10);
alter table public.checkins add constraint checkins_mood_check check (mood >= 1 and mood <= 5);
alter table public.checkins add constraint checkins_progress_pct_check check (progress_pct >= 0 and progress_pct <= 100);

alter table public.focus_sessions add constraint focus_sessions_pkey primary key (id);
alter table public.focus_sessions add constraint focus_sessions_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table public.transactions add constraint transactions_pkey primary key (id);
alter table public.transactions add constraint transactions_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.transactions add constraint transactions_type_check check (type = any (array['entrada','saida']));

alter table public.goals_90 add constraint goals_90_pkey primary key (id);
alter table public.goals_90 add constraint goals_90_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.goals_90 add constraint goals_90_progress_check check (progress >= 0 and progress <= 100);
alter table public.goals_90 add constraint goals_90_status_check check (status = any (array['active','done','paused']));

alter table public.reminders add constraint reminders_pkey primary key (id);
alter table public.reminders add constraint reminders_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.agenda_events add constraint agenda_events_pkey primary key (id);
alter table public.agenda_events add constraint agenda_events_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.user_badges add constraint user_badges_pkey primary key (id);
alter table public.user_badges add constraint user_badges_user_id_badge_key_key unique (user_id, badge_key);
alter table public.user_badges add constraint user_badges_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.user_badges add constraint user_badges_badge_key_fkey foreign key (badge_key) references badges(key);

alter table public.weekly_challenges add constraint weekly_challenges_pkey primary key (id);
alter table public.weekly_challenges add constraint weekly_challenges_user_id_week_start_key unique (user_id, week_start);
alter table public.weekly_challenges add constraint weekly_challenges_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_pkey primary key (id);
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_user_id_week_start_key unique (user_id, week_start);
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_tier_check check (tier = any (array['Bronze','Prata','Ouro','Lenda']));

alter table public.training_plans add constraint training_plans_pkey primary key (id);
alter table public.training_plans add constraint training_plans_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.training_plans add constraint training_plans_source_type_check check (source_type = any (array['pdf','spreadsheet']));

alter table public.training_entries add constraint training_entries_pkey primary key (id);
alter table public.training_entries add constraint training_entries_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.training_entries add constraint training_entries_training_plan_id_fkey foreign key (training_plan_id) references training_plans(id) on delete cascade;

alter table public.diet_plans add constraint diet_plans_pkey primary key (id);
alter table public.diet_plans add constraint diet_plans_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.diet_plans add constraint diet_plans_source_type_check check (source_type = any (array['pdf','spreadsheet']));

alter table public.diet_meals add constraint diet_meals_pkey primary key (id);
alter table public.diet_meals add constraint diet_meals_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.diet_meals add constraint diet_meals_diet_plan_id_fkey foreign key (diet_plan_id) references diet_plans(id) on delete cascade;
alter table public.diet_meals add constraint diet_meals_meal_key_check check (meal_key = any (array['pequeno_almoco','almoco','jantar','lanche']));

alter table public.body_measurements add constraint body_measurements_pkey primary key (id);
alter table public.body_measurements add constraint body_measurements_user_id_date_key unique (user_id, date);
alter table public.body_measurements add constraint body_measurements_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table public.books add constraint books_pkey primary key (id);
alter table public.books add constraint books_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.book_progress add constraint book_progress_pkey primary key (id);
alter table public.book_progress add constraint book_progress_user_id_book_id_key unique (user_id, book_id);
alter table public.book_progress add constraint book_progress_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_progress add constraint book_progress_book_id_fkey foreign key (book_id) references books(id) on delete cascade;

alter table public.book_highlights add constraint book_highlights_pkey primary key (id);
alter table public.book_highlights add constraint book_highlights_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_highlights add constraint book_highlights_book_id_fkey foreign key (book_id) references books(id) on delete cascade;

alter table public.book_notes add constraint book_notes_pkey primary key (id);
alter table public.book_notes add constraint book_notes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_notes add constraint book_notes_book_id_fkey foreign key (book_id) references books(id) on delete cascade;

alter table public.book_bookmarks add constraint book_bookmarks_pkey primary key (id);
alter table public.book_bookmarks add constraint book_bookmarks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_bookmarks add constraint book_bookmarks_book_id_fkey foreign key (book_id) references books(id) on delete cascade;

alter table public.reading_preferences add constraint reading_preferences_pkey primary key (id);
alter table public.reading_preferences add constraint reading_preferences_user_id_key unique (user_id);
alter table public.reading_preferences add constraint reading_preferences_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES (não-constraint)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists agenda_events_user_date_idx on public.agenda_events (user_id, date);
create index if not exists idx_book_bookmarks_user_book on public.book_bookmarks (user_id, book_id, page);
create index if not exists idx_book_highlights_user_book on public.book_highlights (user_id, book_id, page);
create index if not exists idx_book_notes_user_book on public.book_notes (user_id, book_id, page);
create index if not exists idx_book_progress_user_book on public.book_progress (user_id, book_id);
create index if not exists idx_books_user_id on public.books (user_id, created_at desc);
create unique index if not exists diet_meals_unique_day on public.diet_meals (user_id, diet_plan_id, date, meal_key);
create index if not exists diet_meals_user_date_idx on public.diet_meals (user_id, date desc);
create index if not exists diet_plans_user_created_idx on public.diet_plans (user_id, created_at desc);
create unique index if not exists training_entries_unique_day on public.training_entries (user_id, training_plan_id, date);
create index if not exists training_entries_user_date_idx on public.training_entries (user_id, date desc);
create index if not exists training_plans_user_created_idx on public.training_plans (user_id, created_at desc);
create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists weekly_challenges_user_week_idx on public.weekly_challenges (user_id, week_start desc);
create index if not exists weekly_league_snapshots_week_start_idx on public.weekly_league_snapshots (week_start, points desc, updated_at);
create index if not exists weekly_league_snapshots_user_idx on public.weekly_league_snapshots (user_id, week_start desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (ativado em todas as tabelas public)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.agenda_events enable row level security;
alter table public.badges enable row level security;
alter table public.body_measurements enable row level security;
alter table public.book_bookmarks enable row level security;
alter table public.book_highlights enable row level security;
alter table public.book_notes enable row level security;
alter table public.book_progress enable row level security;
alter table public.books enable row level security;
alter table public.checkins enable row level security;
alter table public.diet_meals enable row level security;
alter table public.diet_plans enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.goals_90 enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habits enable row level security;
alter table public.life_area_scores enable row level security;
alter table public.profiles enable row level security;
alter table public.program_days enable row level security;
alter table public.program_tasks enable row level security;
alter table public.program_weeks enable row level security;
alter table public.programs enable row level security;
alter table public.reading_preferences enable row level security;
alter table public.reminders enable row level security;
alter table public.task_templates enable row level security;
alter table public.training_entries enable row level security;
alter table public.training_plans enable row level security;
alter table public.transactions enable row level security;
alter table public.user_assessments enable row level security;
alter table public.user_badges enable row level security;
alter table public.weekly_challenges enable row level security;
alter table public.weekly_league_snapshots enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- POLICIES (dono = user_id / id). Transcritas fielmente do banco real.
-- Obs.: 'reminders' e 'transactions' têm policies redundantes (ALL + granulares)
--        — mantidas como estão em produção.
-- ─────────────────────────────────────────────────────────────────────────────
create policy agenda_events_select_own on public.agenda_events for select using (auth.uid() = user_id);
create policy agenda_events_insert_own on public.agenda_events for insert with check (auth.uid() = user_id);
create policy agenda_events_update_own on public.agenda_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy agenda_events_delete_own on public.agenda_events for delete using (auth.uid() = user_id);

create policy "Users can read own measurements"   on public.body_measurements for select using (auth.uid() = user_id);
create policy "Users can insert own measurements" on public.body_measurements for insert with check (auth.uid() = user_id);
create policy "Users can update own measurements" on public.body_measurements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own measurements" on public.body_measurements for delete using (auth.uid() = user_id);

create policy book_bookmarks_select_own on public.book_bookmarks for select using (auth.uid() = user_id);
create policy book_bookmarks_insert_own on public.book_bookmarks for insert with check (auth.uid() = user_id);
create policy book_bookmarks_update_own on public.book_bookmarks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy book_bookmarks_delete_own on public.book_bookmarks for delete using (auth.uid() = user_id);

create policy book_highlights_select_own on public.book_highlights for select using (auth.uid() = user_id);
create policy book_highlights_insert_own on public.book_highlights for insert with check (auth.uid() = user_id);
create policy book_highlights_update_own on public.book_highlights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy book_highlights_delete_own on public.book_highlights for delete using (auth.uid() = user_id);

create policy book_notes_select_own on public.book_notes for select using (auth.uid() = user_id);
create policy book_notes_insert_own on public.book_notes for insert with check (auth.uid() = user_id);
create policy book_notes_update_own on public.book_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy book_notes_delete_own on public.book_notes for delete using (auth.uid() = user_id);

create policy book_progress_select_own on public.book_progress for select using (auth.uid() = user_id);
create policy book_progress_insert_own on public.book_progress for insert with check (auth.uid() = user_id);
create policy book_progress_update_own on public.book_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy book_progress_delete_own on public.book_progress for delete using (auth.uid() = user_id);

create policy books_select_own on public.books for select using (auth.uid() = user_id);
create policy books_insert_own on public.books for insert with check (auth.uid() = user_id);
create policy books_update_own on public.books for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy books_delete_own on public.books for delete using (auth.uid() = user_id);

create policy "Check-ins próprios" on public.checkins for all using (auth.uid() = user_id);

create policy diet_meals_select_own on public.diet_meals for select using (auth.uid() = user_id);
create policy diet_meals_insert_own on public.diet_meals for insert with check (auth.uid() = user_id);
create policy diet_meals_update_own on public.diet_meals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy diet_meals_delete_own on public.diet_meals for delete using (auth.uid() = user_id);

create policy diet_plans_select_own on public.diet_plans for select using (auth.uid() = user_id);
create policy diet_plans_insert_own on public.diet_plans for insert with check (auth.uid() = user_id);
create policy diet_plans_update_own on public.diet_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy diet_plans_delete_own on public.diet_plans for delete using (auth.uid() = user_id);

create policy "Sessões próprias" on public.focus_sessions for all using (auth.uid() = user_id);
create policy "Objectivos próprios" on public.goals_90 for all using (auth.uid() = user_id);
create policy "Logs próprios" on public.habit_logs for all using (auth.uid() = user_id);
create policy "Hábitos próprios" on public.habits for all using (auth.uid() = user_id);
create policy "Users manage own scores" on public.life_area_scores for all using (auth.uid() = user_id);
create policy "Perfil próprio" on public.profiles for all using (auth.uid() = id);

create policy "Users manage own days"  on public.program_days  for all using (program_id in (select id from programs where user_id = auth.uid()));
create policy "Users manage own tasks" on public.program_tasks for all using (auth.uid() = user_id);
create policy "Users manage own weeks" on public.program_weeks for all using (program_id in (select id from programs where user_id = auth.uid()));
create policy "Users manage own programs" on public.programs for all using (auth.uid() = user_id);

create policy reading_preferences_select_own on public.reading_preferences for select using (auth.uid() = user_id);
create policy reading_preferences_insert_own on public.reading_preferences for insert with check (auth.uid() = user_id);
create policy reading_preferences_update_own on public.reading_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reading_preferences_delete_own on public.reading_preferences for delete using (auth.uid() = user_id);

create policy "Lembretes próprios" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own reminders" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy training_entries_select_own on public.training_entries for select using (auth.uid() = user_id);
create policy training_entries_insert_own on public.training_entries for insert with check (auth.uid() = user_id);
create policy training_entries_update_own on public.training_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy training_entries_delete_own on public.training_entries for delete using (auth.uid() = user_id);

create policy training_plans_select_own on public.training_plans for select using (auth.uid() = user_id);
create policy training_plans_insert_own on public.training_plans for insert with check (auth.uid() = user_id);
create policy training_plans_update_own on public.training_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy training_plans_delete_own on public.training_plans for delete using (auth.uid() = user_id);

create policy "Transacções próprias" on public.transactions for all using (auth.uid() = user_id);
create policy transactions_select_own on public.transactions for select using (auth.uid() = user_id);
create policy transactions_insert_own on public.transactions for insert with check (auth.uid() = user_id);
create policy transactions_update_own on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transactions_delete_own on public.transactions for delete using (auth.uid() = user_id);

create policy "Users manage own assessments" on public.user_assessments for all using (auth.uid() = user_id);
create policy "Badges próprios" on public.user_badges for all using (auth.uid() = user_id);

create policy "weekly challenges select own" on public.weekly_challenges for select to authenticated using (auth.uid() = user_id);
create policy "weekly challenges insert own" on public.weekly_challenges for insert to authenticated with check (auth.uid() = user_id);
create policy "weekly challenges update own" on public.weekly_challenges for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly challenges delete own" on public.weekly_challenges for delete to authenticated using (auth.uid() = user_id);

create policy "weekly league select authenticated" on public.weekly_league_snapshots for select to authenticated using (true);
create policy "weekly league insert own" on public.weekly_league_snapshots for insert to authenticated with check (auth.uid() = user_id);
create policy "weekly league update own" on public.weekly_league_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NOTA: 'badges' e 'task_templates' têm RLS ativo mas SEM policies (catálogos
-- de leitura via service role / seeds). Mantido como em produção.

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÕES + TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Cria profile ao registar utilizador.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recalcula nível (1–6) e título a partir do MELHOR streak (ofensiva máxima).
-- Substitui o antigo add_xp: a progressão é por consistência sustentada, não XP.
-- Limiares (dias de ofensiva): 0,3,7,21,45,90 → níveis 1..6.
create or replace function public.recompute_level(p_user_id uuid)
returns void language plpgsql security definer as $function$
declare
  best int;
  new_level int;
  new_title text;
begin
  select coalesce(streak_best, 0) into best from profiles where id = p_user_id;
  new_level := case
    when best >= 90 then 6
    when best >= 45 then 5
    when best >= 21 then 4
    when best >= 7  then 3
    when best >= 3  then 2
    else 1
  end;
  new_title := case new_level
    when 6 then 'Antifrágil'
    when 5 then 'Imparável'
    when 4 then 'Estrategista'
    when 3 then 'Focado'
    when 2 then 'Consistente'
    else 'Recruta'
  end;
  update profiles
  set level = new_level, title = new_title
  where id = p_user_id;
end;
$function$;

-- Atualiza streak diário (retorna o streak atual) e recalcula nível/título.
create or replace function public.update_streak(p_user_id uuid)
returns integer language plpgsql security definer as $function$
declare
  last_date date;
  today date := current_date;
  new_streak int;
begin
  select streak_current, streak_last_date
  into new_streak, last_date
  from profiles where id = p_user_id;

  if last_date = today - 1 then
    new_streak := coalesce(new_streak, 0) + 1;
  elsif last_date = today then
    return new_streak; -- já foi atualizado hoje
  else
    new_streak := 1; -- quebrou ou primeiro dia
  end if;

  update profiles
  set streak_current   = new_streak,
      streak_best      = greatest(coalesce(streak_best, 0), new_streak),
      streak_last_date = today
  where id = p_user_id;

  perform public.recompute_level(p_user_id);

  return new_streak;
end;
$function$;

-- Event trigger: ativa RLS automaticamente em novas tabelas de public.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog','information_schema')
       and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
      exception when others then null;
      end;
    end if;
  end loop;
end;
$function$;

do $$ begin
  create event trigger rls_auto_enable_trg on ddl_command_end
    when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
    execute function public.rls_auto_enable();
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- goal_milestones — usada por /objetivos (getMilestones/saveMilestone/
-- toggleMilestone). Estava em FALTA no banco; aplicada via migration
-- add_goal_milestones e agora parte oficial do schema.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.goal_milestones (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.goals_90(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  due_date   date,
  created_at timestamptz not null default now()
);
alter table public.goal_milestones enable row level security;
do $$ begin
  create policy "Milestones próprios" on public.goal_milestones
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists goal_milestones_goal_idx on public.goal_milestones (goal_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo de conquistas (badges). As keys têm de existir para o FK de
-- user_badges. Rebaseado em consistência: sem badges de XP.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.badges (key, name, description, icon) values
  ('primeiro_checkin', 'Primeira Vez', 'O teu primeiro check-in.', '🌅'),
  ('streak_7',         'Uma Semana',   '7 dias de ofensiva seguidos.', '🔥'),
  ('streak_21',        'Três Semanas', '21 dias de ofensiva seguidos.', '⚡'),
  ('streak_100',       'Centenário',   '100 dias de ofensiva seguidos.', '💎'),
  ('ritmo_80',         'Em Chamas',    'Atingiste um Ritmo de 80 ou mais.', '🚀'),
  ('consistencia_30',  'Inabalável',   'A tua melhor ofensiva chegou aos 30 dias.', '🏔️')
on conflict (key) do nothing;
