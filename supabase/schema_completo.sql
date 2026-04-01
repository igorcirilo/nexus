-- ============================================================
-- NEXUS — Schema Completo (todas as fases)
-- Cola e corre no Supabase SQL Editor → New Query
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- PERFIL
-- ────────────────────────────────────────────────────────────
create table if not exists profiles (
  id                   uuid references auth.users on delete cascade primary key,
  username             text,
  created_at           timestamptz default now(),
  xp_total             int default 0,
  level                int default 1,
  title                text default 'Recruta',
  streak_current       int default 0,
  streak_best          int default 0,
  streak_last_date     date,
  mission_today        text,
  energy_today         int default 5,
  onboarded            boolean default false,
  -- Corpo
  age                  int,
  sex                  text check (sex in ('masculino','feminino','outro')),
  weight_kg            numeric(5,2),
  height_cm            int,
  goal_weight          numeric(5,2),
  water_goal_ml        int default 2000,
  workouts_per_week    int default 3,
  sleep_goal_h         numeric(3,1) default 8,
  read_pages_day       int default 10,
  -- Finanças
  fin_monthly_save     numeric(10,2),
  fin_debt_goal        numeric(10,2),
  fin_reserve_goal     numeric(10,2),
  fin_current_savings  numeric(12,2) default 0,
  -- Metas 90 dias
  goal_90_personal     text,
  goal_90_career       text,
  goal_90_health       text,
  -- XP config
  xp_weekly_goal       int default 500,
  completion_pct_goal  int default 80
);

alter table profiles enable row level security;
create policy "Perfil próprio" on profiles
  for all using (auth.uid() = id);

-- Trigger: cria perfil automaticamente ao registar
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ────────────────────────────────────────────────────────────
-- HÁBITOS
-- ────────────────────────────────────────────────────────────
create table if not exists habits (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  name        text not null,
  area        text not null,
  xp_reward   int default 10,
  time_window text,
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table habits enable row level security;
create policy "Hábitos próprios" on habits
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- REGISTOS DE HÁBITOS
-- ────────────────────────────────────────────────────────────
create table if not exists habit_logs (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade,
  habit_id     uuid references habits(id) on delete cascade,
  date         date not null default current_date,
  completed    boolean default false,
  completed_at timestamptz,
  unique (user_id, habit_id, date)
);

alter table habit_logs enable row level security;
create policy "Logs próprios" on habit_logs
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- CHECK-INS
-- ────────────────────────────────────────────────────────────
create table if not exists checkins (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade,
  date         date not null default current_date,
  phase        text not null check (phase in ('manha','tarde','noite')),
  sleep_hours  numeric(3,1),
  energy       int check (energy between 1 and 10),
  mood         int check (mood between 1 and 5),
  mission      text,
  will_train   boolean,
  progress_pct int check (progress_pct between 0 and 100),
  focus_level  text,
  next_action  text,
  mission_done text,
  win_of_day   text,
  reflection   text,
  xp_earned    int default 0,
  completed_at timestamptz default now(),
  unique (user_id, date, phase)
);

alter table checkins enable row level security;
create policy "Check-ins próprios" on checkins
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- OBJECTIVOS 90 DIAS
-- ────────────────────────────────────────────────────────────
create table if not exists goals_90 (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references profiles(id) on delete cascade,
  title      text not null,
  area       text not null,
  start_date date not null default current_date,
  end_date   date not null,
  progress   int default 0 check (progress between 0 and 100),
  status     text default 'active' check (status in ('active','done','paused')),
  created_at timestamptz default now()
);

alter table goals_90 enable row level security;
create policy "Objectivos próprios" on goals_90
  for all using (auth.uid() = user_id);

-- Marcos dos objectivos
create table if not exists goal_milestones (
  id         uuid default uuid_generate_v4() primary key,
  goal_id    uuid references goals_90(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  title      text not null,
  done       boolean default false,
  due_date   date,
  created_at timestamptz default now()
);

alter table goal_milestones enable row level security;
create policy "Marcos próprios" on goal_milestones
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- SESSÕES DE FOCO
-- ────────────────────────────────────────────────────────────
create table if not exists focus_sessions (
  id        uuid default uuid_generate_v4() primary key,
  user_id   uuid references profiles(id) on delete cascade,
  date      date not null default current_date,
  duration  int not null,
  task      text,
  xp_earned int default 10,
  created_at timestamptz default now()
);

alter table focus_sessions enable row level security;
create policy "Sessões próprias" on focus_sessions
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- BADGES
-- ────────────────────────────────────────────────────────────
create table if not exists badges (
  id          uuid default uuid_generate_v4() primary key,
  key         text unique not null,
  name        text not null,
  description text,
  icon        text,
  xp_reward   int default 100
);

create table if not exists user_badges (
  id        uuid default uuid_generate_v4() primary key,
  user_id   uuid references profiles(id) on delete cascade,
  badge_key text references badges(key),
  earned_at timestamptz default now(),
  unique (user_id, badge_key)
);

alter table user_badges enable row level security;
create policy "Badges próprios" on user_badges
  for all using (auth.uid() = user_id);

insert into badges (key, name, description, icon, xp_reward) values
  ('streak_7',    '7 Dias',         '7 dias consecutivos',          '🔥', 100),
  ('streak_14',   '14 Dias',        'Duas semanas sem parar',       '🔥', 150),
  ('streak_30',   '30 Dias',        'Um mês de consistência',       '🏆', 500),
  ('streak_90',   '90 Dias',        'Antifrágil — 3 meses',        '💎', 2000),
  ('energy_max',  'Energia Máxima', 'Energia 10/10 num check-in',   '⚡', 50),
  ('mission_done','Missão Cumprida','Missão principal concluída',   '🎯', 75),
  ('focus_10',    'Foco x10',       '10 sessões Pomodoro',          '🧠', 200),
  ('all_habits',  'Dia Perfeito',   'Todos os hábitos num dia',     '✨', 150)
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────
-- LEMBRETES
-- ────────────────────────────────────────────────────────────
create table if not exists reminders (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  description text,
  time        time not null,
  days        int[] not null,
  active      boolean default true,
  type        text default 'custom'
    check (type in ('checkin_manha','checkin_tarde','checkin_noite','habito','custom')),
  created_at  timestamptz default now()
);

alter table reminders enable row level security;
create policy "Lembretes próprios" on reminders
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- TRANSACÇÕES FINANCEIRAS
-- ────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  date        date not null default current_date,
  type        text not null check (type in ('entrada','saida')),
  category    text not null,
  description text,
  amount      numeric(10,2) not null,
  created_at  timestamptz default now()
);

alter table transactions enable row level security;
create policy "Transacções próprias" on transactions
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- AGENDA
-- ────────────────────────────────────────────────────────────
create table if not exists agenda_events (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  description text,
  date        date not null,
  time        time,
  end_time    time,
  color       text default '#E8A838',
  all_day     boolean default false,
  created_at  timestamptz default now()
);

alter table agenda_events enable row level security;
create policy "Eventos próprios" on agenda_events
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────────────────────
create index if not exists idx_habit_logs_user_date    on habit_logs(user_id, date desc);
create index if not exists idx_checkins_user_date      on checkins(user_id, date desc);
create index if not exists idx_transactions_user_date  on transactions(user_id, date desc);
create index if not exists idx_agenda_user_date        on agenda_events(user_id, date);
create index if not exists idx_focus_sessions_user     on focus_sessions(user_id, date desc);

-- ────────────────────────────────────────────────────────────
-- FUNÇÕES
-- ────────────────────────────────────────────────────────────
create or replace function add_xp(p_user_id uuid, p_xp int)
returns void language plpgsql security definer as $$
declare
  current_xp int;
  new_level   int;
  new_title   text;
begin
  select xp_total into current_xp from profiles where id = p_user_id;
  current_xp := coalesce(current_xp, 0) + p_xp;
  new_level := greatest(1, least(20, floor((-1 + sqrt(1 + 8 * current_xp / 500.0)) / 2) + 1));
  new_title := case
    when new_level < 3  then 'Recruta'
    when new_level < 5  then 'Consistente'
    when new_level < 8  then 'Focado'
    when new_level < 11 then 'Estrategista'
    when new_level < 15 then 'Imparável'
    else 'Antifrágil'
  end;
  update profiles set xp_total = current_xp, level = new_level, title = new_title
  where id = p_user_id;
end;
$$;

create or replace function update_streak(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  last_date   date;
  today_date  date := current_date;
  new_streak  int;
begin
  select streak_current, streak_last_date
  into new_streak, last_date from profiles where id = p_user_id;

  if last_date = today_date - 1 then
    new_streak := coalesce(new_streak, 0) + 1;
  elsif last_date = today_date then
    return new_streak;
  else
    new_streak := 1;
  end if;

  update profiles
  set streak_current   = new_streak,
      streak_best      = greatest(coalesce(streak_best, 0), new_streak),
      streak_last_date = today_date
  where id = p_user_id;
  return new_streak;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- MARCAR UTILIZADORES EXISTENTES COMO ONBOARDED
-- ────────────────────────────────────────────────────────────
update profiles set onboarded = true where onboarded is false or onboarded is null;
