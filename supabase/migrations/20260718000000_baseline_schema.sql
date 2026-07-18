-- ============================================================================
-- NEXUS — schema_completo.sql
-- ----------------------------------------------------------------------------
-- DUMP FIEL do schema REAL do projeto Supabase de produção
-- (projeto jsslyritdivjtsiwdorm), extraído via catálogos do Postgres
-- em 2026-07-18 (regenerado; substitui o dump de 2026-07-11).
-- Use este ficheiro para recriar a base de dados num projeto NOVO/vazio.
-- Cópia idêntica vive em supabase/migrations/ como baseline (ver
-- supabase/README.md para o processo de manutenção).
--
-- Inclui as 38 tabelas existentes, constraints, índices, RLS (96 policies),
-- as funções (update_streak, recompute_level, handle_new_user,
-- repair_mojibake, rls_auto_enable) e os triggers. NÃO contém dados.
--
-- Notas:
--  · A função add_xp referida em docs antigos NÃO existe no banco e o código
--    não a chama (só update_streak em src/lib/supabase.ts).
--  · O job pg_cron que chama a Edge Function send-reminders NÃO está neste
--    dump (contém um secret; ver docs/NOTIFICACOES_AGENDADAS.md).
--  · reminders e transactions têm policies redundantes (ALL + granulares) —
--    dump fiel; consolidar é tarefa futura.
--
-- Ordem: extensões → tabelas → PK/UNIQUE → CHECK → FK → índices → RLS →
--        policies → funções → triggers.
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists "uuid-ossp";    -- uuid_generate_v4()
-- pg_cron e pg_net são usados pelas notificações push (ver
-- notifications_push_v1.sql); ativar no dashboard se necessário.

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELAS (apenas colunas; constraints/índices/RLS adicionados depois)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.agenda_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  description text,
  date date not null,
  time time without time zone,
  end_time time without time zone,
  color text default '#E8A838'::text not null,
  all_day boolean default false not null,
  created_at timestamp with time zone default now() not null,
  notified_at timestamp with time zone
);

create table if not exists public.badges (
  id uuid default uuid_generate_v4() not null,
  key text not null,
  name text not null,
  description text,
  icon text,
  xp_reward integer default 100
);

create table if not exists public.body_measurements (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  date date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.book_bookmarks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  label text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.book_highlights (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  color text default '#E8A838'::text not null,
  excerpt text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.book_notes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid not null,
  page integer not null,
  note text not null,
  excerpt text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.book_progress (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid not null,
  current_page integer default 1 not null,
  progress_pct numeric(5,2) default 0 not null,
  updated_at timestamp with time zone default now() not null,
  -- Marca-d'água da página mais avançada; releitura não conta como
  -- pages_read (migration book_progress_furthest_v1.sql).
  furthest_page integer
);

create table if not exists public.books (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  author text,
  source_file_name text,
  cover_label text,
  raw_content jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.checkins (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  date date default CURRENT_DATE not null,
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
  completed_at timestamp with time zone default now()
);

create table if not exists public.day_item_checks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  item_type text not null,
  item_id uuid not null,
  date date not null,
  completed boolean default true not null,
  completed_at timestamp with time zone default now() not null
);

create table if not exists public.diet_meals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  diet_plan_id uuid not null,
  date date not null,
  meal_key text not null,
  completed boolean default false not null,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.diet_plans (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  source_type text not null,
  source_file_name text,
  summary text,
  raw_content jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.focus_sessions (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  date date default CURRENT_DATE not null,
  duration integer not null,
  task text,
  xp_earned integer default 30,
  created_at timestamp with time zone default now()
);

create table if not exists public.goal_milestones (
  id uuid default gen_random_uuid() not null,
  goal_id uuid not null,
  user_id uuid not null,
  title text not null,
  done boolean default false not null,
  due_date date,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.goals_90 (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  title text not null,
  area text not null,
  start_date date default CURRENT_DATE not null,
  end_date date not null,
  progress integer default 0,
  status text default 'active'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.habit_logs (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  habit_id uuid,
  date date default CURRENT_DATE not null,
  completed boolean default false,
  completed_at timestamp with time zone
);

create table if not exists public.habits (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  name text not null,
  area text not null,
  xp_reward integer default 20,
  time_window text,
  active boolean default true,
  created_at timestamp with time zone default now(),
  source text default 'manual'::text not null,
  difficulty smallint default 2 not null,
  catalog_key text,
  last_notified_at timestamp with time zone,
  days integer[]
);

create table if not exists public.life_area_scores (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  assessment_id uuid,
  area text not null,
  score integer not null,
  snapshot_at timestamp with time zone default now()
);

create table if not exists public.profiles (
  id uuid not null,
  username text,
  created_at timestamp with time zone default now(),
  xp_total integer default 0,
  level integer default 1,
  title text default 'Recruta'::text,
  streak_current integer default 0,
  streak_best integer default 0,
  streak_last_date date,
  mission_today text,
  energy_today integer default 5,
  onboarded boolean default false,
  fin_current_savings numeric(12,2) default 0, -- legada: a reserva passou a ser derivada (ver fin_savings_base)
  fin_monthly_save numeric(10,2),
  fin_reserve_goal numeric(10,2),
  last_login_bonus date,
  streak_freeze_used_week text,
  program_id uuid,
  initial_score integer,
  current_score integer,
  onboarding_version integer default 1,
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
  completion_pct_goal integer,
  avatar_url text,
  habit_level smallint,
  fin_budgets jsonb default '{}'::jsonb not null,
  -- Poupança fora do histórico registado (saldo inicial + ajustes manuais).
  -- Reserva mostrada = fin_savings_base + Σ líquido das transações "Poupança"
  -- (migration financas_reserva_v1.sql).
  fin_savings_base numeric(12,2) default 0,
  -- Categorias de saída criadas pelo utilizador ({name,emoji}) e categorias
  -- marcadas como "conta fixa" (migration financas_categorias_v1.sql).
  fin_categories jsonb default '[]'::jsonb not null,
  fin_fixed_cats jsonb default '[]'::jsonb not null
);

create table if not exists public.program_days (
  id uuid default gen_random_uuid() not null,
  program_id uuid,
  week_id uuid,
  day_number integer not null,
  date date not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.program_tasks (
  id uuid default gen_random_uuid() not null,
  program_id uuid,
  day_id uuid,
  user_id uuid not null,
  template_id uuid,
  title text not null,
  description text,
  area text not null,
  difficulty integer default 1,
  xp_reward integer default 20,
  status text default 'pending'::text,
  source text default 'generated'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.program_weeks (
  id uuid default gen_random_uuid() not null,
  program_id uuid,
  week_number integer not null,
  theme text,
  starts_on date not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.programs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  assessment_id uuid,
  status text default 'active'::text,
  started_at date not null,
  ends_at date not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now() not null,
  timezone text
);

create table if not exists public.quit_habits (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  area text,
  motivation text,
  quit_date date default CURRENT_DATE not null,
  best_streak integer default 0 not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.quit_relapses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  quit_habit_id uuid not null,
  date date default CURRENT_DATE not null,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.reading_preferences (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  theme text default 'sepia'::text not null,
  reading_mode text default 'paginado'::text not null,
  font_scale numeric(4,2) default 1 not null,
  line_height numeric(4,2) default 1.8 not null,
  margin_px integer default 24 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.reading_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  book_id uuid not null,
  date date not null,
  duration_minutes integer default 0 not null,
  pages_read integer default 0 not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.recurring_rules (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  day_of_month integer default 1 not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.reminders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  time text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  days text[] default '{}'::text[],
  type text default 'custom'::text,
  description text,
  last_sent_at timestamp with time zone,
  date date,
  -- Conclusão definitiva de lembrete avulso; sem ela o avulso "carrega"
  -- dia após dia (migration reminders_carryover_v1.sql).
  completed_at timestamp with time zone
);

create table if not exists public.task_templates (
  id uuid default gen_random_uuid() not null,
  area text not null,
  title text not null,
  description text,
  difficulty integer default 1,
  frequency_per_week integer default 7,
  xp_reward integer default 20,
  tags text[],
  active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.training_entries (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  training_plan_id uuid not null,
  date date not null,
  completed boolean default false not null,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.training_plans (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  source_type text not null,
  source_file_name text,
  summary text,
  raw_content jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.transactions (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  date date default CURRENT_DATE not null,
  type text not null,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  created_at timestamp with time zone default now(),
  recurring_id uuid,
  from_reserve boolean default false not null
);

create table if not exists public.user_assessments (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  version integer default 2,
  responses jsonb not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.user_badges (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  badge_key text,
  earned_at timestamp with time zone default now()
);

create table if not exists public.weekly_challenges (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  week_start date not null,
  week_end date not null,
  title text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.weekly_league_snapshots (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  week_start date not null,
  week_end date not null,
  points integer default 0 not null,
  tier text not null,
  username text default 'Guerreiro'::text not null,
  level integer default 1 not null,
  title text default 'Recruta'::text not null,
  updated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PRIMARY KEYS e UNIQUE (antes das FKs, que dependem delas)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.agenda_events add constraint agenda_events_pkey PRIMARY KEY (id);
alter table public.badges add constraint badges_pkey PRIMARY KEY (id);
alter table public.badges add constraint badges_key_key UNIQUE (key);
alter table public.body_measurements add constraint body_measurements_pkey PRIMARY KEY (id);
alter table public.body_measurements add constraint body_measurements_user_id_date_key UNIQUE (user_id, date);
alter table public.book_bookmarks add constraint book_bookmarks_pkey PRIMARY KEY (id);
alter table public.book_highlights add constraint book_highlights_pkey PRIMARY KEY (id);
alter table public.book_notes add constraint book_notes_pkey PRIMARY KEY (id);
alter table public.book_progress add constraint book_progress_pkey PRIMARY KEY (id);
alter table public.book_progress add constraint book_progress_user_id_book_id_key UNIQUE (user_id, book_id);
alter table public.books add constraint books_pkey PRIMARY KEY (id);
alter table public.checkins add constraint checkins_pkey PRIMARY KEY (id);
alter table public.checkins add constraint checkins_user_id_date_phase_key UNIQUE (user_id, date, phase);
alter table public.day_item_checks add constraint day_item_checks_pkey PRIMARY KEY (id);
alter table public.day_item_checks add constraint day_item_checks_unique UNIQUE (user_id, item_type, item_id, date);
alter table public.diet_meals add constraint diet_meals_pkey PRIMARY KEY (id);
alter table public.diet_plans add constraint diet_plans_pkey PRIMARY KEY (id);
alter table public.focus_sessions add constraint focus_sessions_pkey PRIMARY KEY (id);
alter table public.goal_milestones add constraint goal_milestones_pkey PRIMARY KEY (id);
alter table public.goals_90 add constraint goals_90_pkey PRIMARY KEY (id);
alter table public.habit_logs add constraint habit_logs_pkey PRIMARY KEY (id);
alter table public.habit_logs add constraint habit_logs_user_id_habit_id_date_key UNIQUE (user_id, habit_id, date);
alter table public.habits add constraint habits_pkey PRIMARY KEY (id);
alter table public.life_area_scores add constraint life_area_scores_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.program_days add constraint program_days_pkey PRIMARY KEY (id);
alter table public.program_tasks add constraint program_tasks_pkey PRIMARY KEY (id);
alter table public.program_weeks add constraint program_weeks_pkey PRIMARY KEY (id);
alter table public.programs add constraint programs_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.quit_habits add constraint quit_habits_pkey PRIMARY KEY (id);
alter table public.quit_relapses add constraint quit_relapses_pkey PRIMARY KEY (id);
alter table public.reading_preferences add constraint reading_preferences_pkey PRIMARY KEY (id);
alter table public.reading_preferences add constraint reading_preferences_user_id_key UNIQUE (user_id);
alter table public.reading_sessions add constraint reading_sessions_pkey PRIMARY KEY (id);
alter table public.recurring_rules add constraint recurring_rules_pkey PRIMARY KEY (id);
alter table public.reminders add constraint reminders_pkey PRIMARY KEY (id);
alter table public.task_templates add constraint task_templates_pkey PRIMARY KEY (id);
alter table public.training_entries add constraint training_entries_pkey PRIMARY KEY (id);
alter table public.training_plans add constraint training_plans_pkey PRIMARY KEY (id);
alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);
alter table public.user_assessments add constraint user_assessments_pkey PRIMARY KEY (id);
alter table public.user_badges add constraint user_badges_pkey PRIMARY KEY (id);
alter table public.user_badges add constraint user_badges_user_id_badge_key_key UNIQUE (user_id, badge_key);
alter table public.weekly_challenges add constraint weekly_challenges_pkey PRIMARY KEY (id);
alter table public.weekly_challenges add constraint weekly_challenges_user_id_week_start_key UNIQUE (user_id, week_start);
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_pkey PRIMARY KEY (id);
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_user_id_week_start_key UNIQUE (user_id, week_start);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK constraints
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.checkins add constraint checkins_energy_check CHECK (((energy >= 1) AND (energy <= 10)));
alter table public.checkins add constraint checkins_mood_check CHECK (((mood >= 1) AND (mood <= 5)));
alter table public.checkins add constraint checkins_phase_check CHECK ((phase = ANY (ARRAY['manha'::text, 'tarde'::text, 'noite'::text])));
alter table public.checkins add constraint checkins_progress_pct_check CHECK (((progress_pct >= 0) AND (progress_pct <= 100)));
alter table public.day_item_checks add constraint day_item_checks_type_check CHECK ((item_type = ANY (ARRAY['reminder'::text, 'event'::text])));
alter table public.diet_meals add constraint diet_meals_meal_key_check CHECK ((meal_key = ANY (ARRAY['pequeno_almoco'::text, 'almoco'::text, 'jantar'::text, 'lanche'::text])));
alter table public.diet_plans add constraint diet_plans_source_type_check CHECK ((source_type = ANY (ARRAY['pdf'::text, 'spreadsheet'::text])));
alter table public.goals_90 add constraint goals_90_progress_check CHECK (((progress >= 0) AND (progress <= 100)));
alter table public.goals_90 add constraint goals_90_status_check CHECK ((status = ANY (ARRAY['active'::text, 'done'::text, 'paused'::text])));
alter table public.recurring_rules add constraint recurring_rules_amount_check CHECK ((amount > (0)::numeric));
alter table public.recurring_rules add constraint recurring_rules_day_check CHECK (((day_of_month >= 1) AND (day_of_month <= 28)));
alter table public.recurring_rules add constraint recurring_rules_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saida'::text])));
alter table public.training_plans add constraint training_plans_source_type_check CHECK ((source_type = ANY (ARRAY['pdf'::text, 'spreadsheet'::text])));
alter table public.transactions add constraint transactions_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saida'::text])));
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_tier_check CHECK ((tier = ANY (ARRAY['Bronze'::text, 'Prata'::text, 'Ouro'::text, 'Lenda'::text])));

-- ─────────────────────────────────────────────────────────────────────────────
-- FOREIGN KEYS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.agenda_events add constraint agenda_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.body_measurements add constraint body_measurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.book_bookmarks add constraint book_bookmarks_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
alter table public.book_bookmarks add constraint book_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.book_highlights add constraint book_highlights_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
alter table public.book_highlights add constraint book_highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.book_notes add constraint book_notes_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
alter table public.book_notes add constraint book_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.book_progress add constraint book_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
alter table public.book_progress add constraint book_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.books add constraint books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.checkins add constraint checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.day_item_checks add constraint day_item_checks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.diet_meals add constraint diet_meals_diet_plan_id_fkey FOREIGN KEY (diet_plan_id) REFERENCES diet_plans(id) ON DELETE CASCADE;
alter table public.diet_meals add constraint diet_meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.diet_plans add constraint diet_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.focus_sessions add constraint focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.goal_milestones add constraint goal_milestones_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES goals_90(id) ON DELETE CASCADE;
alter table public.goal_milestones add constraint goal_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.goals_90 add constraint goals_90_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.habit_logs add constraint habit_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE;
alter table public.habit_logs add constraint habit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.habits add constraint habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.life_area_scores add constraint life_area_scores_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES user_assessments(id) ON DELETE CASCADE;
alter table public.life_area_scores add constraint life_area_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id);
alter table public.program_days add constraint program_days_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
alter table public.program_days add constraint program_days_week_id_fkey FOREIGN KEY (week_id) REFERENCES program_weeks(id) ON DELETE CASCADE;
alter table public.program_tasks add constraint program_tasks_day_id_fkey FOREIGN KEY (day_id) REFERENCES program_days(id) ON DELETE CASCADE;
alter table public.program_tasks add constraint program_tasks_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
alter table public.program_tasks add constraint program_tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES task_templates(id);
alter table public.program_tasks add constraint program_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.program_weeks add constraint program_weeks_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
alter table public.programs add constraint programs_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES user_assessments(id);
alter table public.programs add constraint programs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.quit_habits add constraint quit_habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.quit_relapses add constraint quit_relapses_habit_fkey FOREIGN KEY (quit_habit_id) REFERENCES quit_habits(id) ON DELETE CASCADE;
alter table public.quit_relapses add constraint quit_relapses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.reading_preferences add constraint reading_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reading_sessions add constraint reading_sessions_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
alter table public.reading_sessions add constraint reading_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.recurring_rules add constraint recurring_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.reminders add constraint reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_entries add constraint training_entries_training_plan_id_fkey FOREIGN KEY (training_plan_id) REFERENCES training_plans(id) ON DELETE CASCADE;
alter table public.training_entries add constraint training_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_plans add constraint training_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.transactions add constraint transactions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES recurring_rules(id) ON DELETE SET NULL;
alter table public.transactions add constraint transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.user_assessments add constraint user_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.user_badges add constraint user_badges_badge_key_fkey FOREIGN KEY (badge_key) REFERENCES badges(key);
alter table public.user_badges add constraint user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.weekly_challenges add constraint weekly_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.weekly_league_snapshots add constraint weekly_league_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES (além dos criados implicitamente por PK/UNIQUE)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX agenda_events_user_date_idx ON public.agenda_events USING btree (user_id, date);
CREATE INDEX idx_book_bookmarks_user_book ON public.book_bookmarks USING btree (user_id, book_id, page);
CREATE INDEX idx_book_highlights_user_book ON public.book_highlights USING btree (user_id, book_id, page);
CREATE INDEX idx_book_notes_user_book ON public.book_notes USING btree (user_id, book_id, page);
CREATE INDEX idx_book_progress_user_book ON public.book_progress USING btree (user_id, book_id);
CREATE INDEX idx_books_user_id ON public.books USING btree (user_id, created_at DESC);
CREATE INDEX day_item_checks_user_date_idx ON public.day_item_checks USING btree (user_id, date);
CREATE UNIQUE INDEX diet_meals_unique_day ON public.diet_meals USING btree (user_id, diet_plan_id, date, meal_key);
CREATE INDEX diet_meals_user_date_idx ON public.diet_meals USING btree (user_id, date DESC);
CREATE INDEX diet_plans_user_created_idx ON public.diet_plans USING btree (user_id, created_at DESC);
CREATE INDEX goal_milestones_goal_idx ON public.goal_milestones USING btree (goal_id);
CREATE INDEX habits_user_source_idx ON public.habits USING btree (user_id, source);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX quit_habits_user_idx ON public.quit_habits USING btree (user_id);
CREATE INDEX quit_relapses_habit_idx ON public.quit_relapses USING btree (quit_habit_id);
CREATE INDEX reading_sessions_user_date ON public.reading_sessions USING btree (user_id, date DESC);
CREATE INDEX recurring_rules_user_idx ON public.recurring_rules USING btree (user_id);
CREATE INDEX reminders_user_date_idx ON public.reminders USING btree (user_id, date) WHERE (date IS NOT NULL);
CREATE UNIQUE INDEX training_entries_unique_day ON public.training_entries USING btree (user_id, training_plan_id, date);
CREATE INDEX training_entries_user_date_idx ON public.training_entries USING btree (user_id, date DESC);
CREATE INDEX training_plans_user_created_idx ON public.training_plans USING btree (user_id, created_at DESC);
CREATE INDEX idx_transactions_user_date ON public.transactions USING btree (user_id, date DESC);
CREATE INDEX transactions_recurring_idx ON public.transactions USING btree (recurring_id);
CREATE INDEX transactions_user_date_idx ON public.transactions USING btree (user_id, date DESC);
CREATE INDEX weekly_challenges_user_week_idx ON public.weekly_challenges USING btree (user_id, week_start DESC);
CREATE INDEX weekly_league_snapshots_user_idx ON public.weekly_league_snapshots USING btree (user_id, week_start DESC);
CREATE INDEX weekly_league_snapshots_week_start_idx ON public.weekly_league_snapshots USING btree (week_start, points DESC, updated_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — enable em todas as tabelas
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
alter table public.day_item_checks enable row level security;
alter table public.diet_meals enable row level security;
alter table public.diet_plans enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.goals_90 enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habits enable row level security;
alter table public.life_area_scores enable row level security;
alter table public.profiles enable row level security;
alter table public.program_days enable row level security;
alter table public.program_tasks enable row level security;
alter table public.program_weeks enable row level security;
alter table public.programs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.quit_habits enable row level security;
alter table public.quit_relapses enable row level security;
alter table public.reading_preferences enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.recurring_rules enable row level security;
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
-- POLICIES (96)
-- Atenção: badges e task_templates têm RLS ativo e NENHUMA policy — qualquer
-- acesso anon/authenticated é negado; os seeds entram via service role.
-- ─────────────────────────────────────────────────────────────────────────────

create policy agenda_events_delete_own on public.agenda_events for delete to public using ((auth.uid() = user_id));
create policy agenda_events_insert_own on public.agenda_events for insert to public with check ((auth.uid() = user_id));
create policy agenda_events_select_own on public.agenda_events for select to public using ((auth.uid() = user_id));
create policy agenda_events_update_own on public.agenda_events for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can delete own measurements" on public.body_measurements for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own measurements" on public.body_measurements for insert to public with check ((auth.uid() = user_id));
create policy "Users can read own measurements" on public.body_measurements for select to public using ((auth.uid() = user_id));
create policy "Users can update own measurements" on public.body_measurements for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy book_bookmarks_delete_own on public.book_bookmarks for delete to public using ((auth.uid() = user_id));
create policy book_bookmarks_insert_own on public.book_bookmarks for insert to public with check ((auth.uid() = user_id));
create policy book_bookmarks_select_own on public.book_bookmarks for select to public using ((auth.uid() = user_id));
create policy book_bookmarks_update_own on public.book_bookmarks for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy book_highlights_delete_own on public.book_highlights for delete to public using ((auth.uid() = user_id));
create policy book_highlights_insert_own on public.book_highlights for insert to public with check ((auth.uid() = user_id));
create policy book_highlights_select_own on public.book_highlights for select to public using ((auth.uid() = user_id));
create policy book_highlights_update_own on public.book_highlights for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy book_notes_delete_own on public.book_notes for delete to public using ((auth.uid() = user_id));
create policy book_notes_insert_own on public.book_notes for insert to public with check ((auth.uid() = user_id));
create policy book_notes_select_own on public.book_notes for select to public using ((auth.uid() = user_id));
create policy book_notes_update_own on public.book_notes for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy book_progress_delete_own on public.book_progress for delete to public using ((auth.uid() = user_id));
create policy book_progress_insert_own on public.book_progress for insert to public with check ((auth.uid() = user_id));
create policy book_progress_select_own on public.book_progress for select to public using ((auth.uid() = user_id));
create policy book_progress_update_own on public.book_progress for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy books_delete_own on public.books for delete to public using ((auth.uid() = user_id));
create policy books_insert_own on public.books for insert to public with check ((auth.uid() = user_id));
create policy books_select_own on public.books for select to public using ((auth.uid() = user_id));
create policy books_update_own on public.books for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Check-ins próprios" on public.checkins for all to public using ((auth.uid() = user_id));
create policy day_item_checks_delete_own on public.day_item_checks for delete to public using ((auth.uid() = user_id));
create policy day_item_checks_insert_own on public.day_item_checks for insert to public with check ((auth.uid() = user_id));
create policy day_item_checks_select_own on public.day_item_checks for select to public using ((auth.uid() = user_id));
create policy day_item_checks_update_own on public.day_item_checks for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy diet_meals_delete_own on public.diet_meals for delete to public using ((auth.uid() = user_id));
create policy diet_meals_insert_own on public.diet_meals for insert to public with check ((auth.uid() = user_id));
create policy diet_meals_select_own on public.diet_meals for select to public using ((auth.uid() = user_id));
create policy diet_meals_update_own on public.diet_meals for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy diet_plans_delete_own on public.diet_plans for delete to public using ((auth.uid() = user_id));
create policy diet_plans_insert_own on public.diet_plans for insert to public with check ((auth.uid() = user_id));
create policy diet_plans_select_own on public.diet_plans for select to public using ((auth.uid() = user_id));
create policy diet_plans_update_own on public.diet_plans for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Sessões próprias" on public.focus_sessions for all to public using ((auth.uid() = user_id));
create policy "Milestones próprios" on public.goal_milestones for all to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Objectivos próprios" on public.goals_90 for all to public using ((auth.uid() = user_id));
create policy "Logs próprios" on public.habit_logs for all to public using ((auth.uid() = user_id));
create policy "Hábitos próprios" on public.habits for all to public using ((auth.uid() = user_id));
create policy "Users manage own scores" on public.life_area_scores for all to public using ((auth.uid() = user_id));
create policy "Perfil próprio" on public.profiles for all to public using ((auth.uid() = id));
create policy "Users manage own days" on public.program_days for all to public using ((program_id IN ( SELECT programs.id
   FROM programs
  WHERE (programs.user_id = auth.uid()))));
create policy "Users manage own tasks" on public.program_tasks for all to public using ((auth.uid() = user_id));
create policy "Users manage own weeks" on public.program_weeks for all to public using ((program_id IN ( SELECT programs.id
   FROM programs
  WHERE (programs.user_id = auth.uid()))));
create policy "Users manage own programs" on public.programs for all to public using ((auth.uid() = user_id));
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to public using ((auth.uid() = user_id));
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to public with check ((auth.uid() = user_id));
create policy push_subscriptions_select_own on public.push_subscriptions for select to public using ((auth.uid() = user_id));
create policy push_subscriptions_update_own on public.push_subscriptions for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy quit_habits_delete_own on public.quit_habits for delete to public using ((auth.uid() = user_id));
create policy quit_habits_insert_own on public.quit_habits for insert to public with check ((auth.uid() = user_id));
create policy quit_habits_select_own on public.quit_habits for select to public using ((auth.uid() = user_id));
create policy quit_habits_update_own on public.quit_habits for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy quit_relapses_delete_own on public.quit_relapses for delete to public using ((auth.uid() = user_id));
create policy quit_relapses_insert_own on public.quit_relapses for insert to public with check ((auth.uid() = user_id));
create policy quit_relapses_select_own on public.quit_relapses for select to public using ((auth.uid() = user_id));
create policy reading_preferences_delete_own on public.reading_preferences for delete to public using ((auth.uid() = user_id));
create policy reading_preferences_insert_own on public.reading_preferences for insert to public with check ((auth.uid() = user_id));
create policy reading_preferences_select_own on public.reading_preferences for select to public using ((auth.uid() = user_id));
create policy reading_preferences_update_own on public.reading_preferences for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy users_own_reading_sessions on public.reading_sessions for all to public using ((auth.uid() = user_id));
create policy recurring_rules_delete_own on public.recurring_rules for delete to public using ((auth.uid() = user_id));
create policy recurring_rules_insert_own on public.recurring_rules for insert to public with check ((auth.uid() = user_id));
create policy recurring_rules_select_own on public.recurring_rules for select to public using ((auth.uid() = user_id));
create policy recurring_rules_update_own on public.recurring_rules for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Lembretes próprios" on public.reminders for all to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users manage own reminders" on public.reminders for all to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy training_entries_delete_own on public.training_entries for delete to public using ((auth.uid() = user_id));
create policy training_entries_insert_own on public.training_entries for insert to public with check ((auth.uid() = user_id));
create policy training_entries_select_own on public.training_entries for select to public using ((auth.uid() = user_id));
create policy training_entries_update_own on public.training_entries for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy training_plans_delete_own on public.training_plans for delete to public using ((auth.uid() = user_id));
create policy training_plans_insert_own on public.training_plans for insert to public with check ((auth.uid() = user_id));
create policy training_plans_select_own on public.training_plans for select to public using ((auth.uid() = user_id));
create policy training_plans_update_own on public.training_plans for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Transacções próprias" on public.transactions for all to public using ((auth.uid() = user_id));
create policy transactions_delete_own on public.transactions for delete to public using ((auth.uid() = user_id));
create policy transactions_insert_own on public.transactions for insert to public with check ((auth.uid() = user_id));
create policy transactions_select_own on public.transactions for select to public using ((auth.uid() = user_id));
create policy transactions_update_own on public.transactions for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users manage own assessments" on public.user_assessments for all to public using ((auth.uid() = user_id));
create policy "Badges próprios" on public.user_badges for all to public using ((auth.uid() = user_id));
create policy "weekly challenges delete own" on public.weekly_challenges for delete to authenticated using ((auth.uid() = user_id));
create policy "weekly challenges insert own" on public.weekly_challenges for insert to authenticated with check ((auth.uid() = user_id));
create policy "weekly challenges select own" on public.weekly_challenges for select to authenticated using ((auth.uid() = user_id));
create policy "weekly challenges update own" on public.weekly_challenges for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "weekly league insert own" on public.weekly_league_snapshots for insert to authenticated with check ((auth.uid() = user_id));
create policy "weekly league select authenticated" on public.weekly_league_snapshots for select to authenticated using (true);
create policy "weekly league update own" on public.weekly_league_snapshots for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÕES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_level(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  update profiles set level = new_level, title = new_title where id = p_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.repair_mojibake(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  if input is null then return null; end if;
  if input !~ '[ÃÂ]' then return input; end if;
  begin
    return convert_from(convert_to(input, 'LATIN1'), 'UTF8');
  exception when others then
    return input;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    return new_streak;
  else
    new_streak := 1;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Event trigger que ativa RLS automaticamente em qualquer tabela nova criada
-- em public (precisa de role com privilégio; no SQL Editor do Supabase funciona).
drop event trigger if exists ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable();
