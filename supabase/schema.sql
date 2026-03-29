-- ============================================================
-- NEXUS — Schema Supabase
-- Cola este SQL em: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- PERFIL DO UTILIZADOR
-- ────────────────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text,
  created_at    timestamptz default now(),
  -- XP & Nível
  xp_total      int default 0,
  level         int default 1,
  title         text default 'Recruta',
  -- Streak
  streak_current  int default 0,
  streak_best     int default 0,
  streak_last_date date,
  -- Preferências
  mission_today text,
  energy_today  int default 5,
  onboarded     boolean default false
);

-- RLS: cada utilizador só vê o próprio perfil
alter table profiles enable row level security;
create policy "Perfil próprio" on profiles
  for all using (auth.uid() = id);

-- Trigger: cria perfil automaticamente ao registar
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
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
  area        text not null, -- 'corpo', 'produtividade', 'idiomas', etc.
  xp_reward   int default 20,
  time_window text, -- '07:00–09:00'
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table habits enable row level security;
create policy "Hábitos próprios" on habits
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- REGISTOS DIÁRIOS DE HÁBITOS
-- ────────────────────────────────────────────────────────────
create table if not exists habit_logs (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  habit_id    uuid references habits(id) on delete cascade,
  date        date not null default current_date,
  completed   boolean default false,
  completed_at timestamptz,
  unique (user_id, habit_id, date)
);

alter table habit_logs enable row level security;
create policy "Logs próprios" on habit_logs
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- CHECK-INS DIÁRIOS
-- ────────────────────────────────────────────────────────────
create table if not exists checkins (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade,
  date         date not null default current_date,
  phase        text not null check (phase in ('manha','tarde','noite')),
  -- Manhã
  sleep_hours  numeric(3,1),
  energy       int check (energy between 1 and 10),
  mood         int check (mood between 1 and 5),
  mission      text,
  will_train   boolean,
  -- Tarde
  progress_pct int check (progress_pct between 0 and 100),
  focus_level  text,
  next_action  text,
  -- Noite
  mission_done text, -- 'completamente', 'em_grande_parte', 'parcialmente', 'nao'
  win_of_day   text,
  reflection   text,
  -- XP
  xp_earned    int default 0,
  completed_at timestamptz default now(),
  unique (user_id, date, phase)
);

alter table checkins enable row level security;
create policy "Check-ins próprios" on checkins
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- OBJECTIVOS DE 90 DIAS
-- ────────────────────────────────────────────────────────────
create table if not exists goals_90 (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  area        text not null,
  start_date  date not null default current_date,
  end_date    date not null,
  progress    int default 0 check (progress between 0 and 100),
  status      text default 'active' check (status in ('active','done','paused')),
  created_at  timestamptz default now()
);

alter table goals_90 enable row level security;
create policy "Objectivos próprios" on goals_90
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- SESSÕES DE FOCO (POMODORO)
-- ────────────────────────────────────────────────────────────
create table if not exists focus_sessions (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  date        date not null default current_date,
  duration    int not null, -- minutos
  task        text,
  xp_earned   int default 30,
  created_at  timestamptz default now()
);

alter table focus_sessions enable row level security;
create policy "Sessões próprias" on focus_sessions
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- BADGES / CONQUISTAS
-- ────────────────────────────────────────────────────────────
create table if not exists badges (
  id          uuid default uuid_generate_v4() primary key,
  key         text unique not null, -- 'streak_7', 'streak_30', etc.
  name        text not null,
  description text,
  icon        text,
  xp_reward   int default 100
);

create table if not exists user_badges (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  badge_key   text references badges(key),
  earned_at   timestamptz default now(),
  unique (user_id, badge_key)
);

alter table user_badges enable row level security;
create policy "Badges próprios" on user_badges
  for all using (auth.uid() = user_id);

-- Badges iniciais
insert into badges (key, name, description, icon, xp_reward) values
  ('streak_7',    '7 Dias',         'Mantiveste o streak por 7 dias', '🔥', 100),
  ('streak_14',   '14 Dias',        'Duas semanas sem parar',         '🔥', 150),
  ('streak_30',   '30 Dias',        'Um mês de consistência real',    '🏆', 500),
  ('streak_90',   '90 Dias',        'Antifrágil — 3 meses',          '💎', 2000),
  ('energy_max',  'Energia Máxima', 'Energia 10/10 num check-in',    '⚡', 50),
  ('mission_done','Missão Cumprida','Completaste a missão principal', '🎯', 75),
  ('focus_10',    'Foco x10',       '10 sessões Pomodoro concluídas','🧠', 200),
  ('all_habits',  'Dia Perfeito',   'Todos os hábitos num dia',      '✨', 150)
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO: ATUALIZAR XP E STREAK
-- ────────────────────────────────────────────────────────────
create or replace function add_xp(p_user_id uuid, p_xp int)
returns void language plpgsql security definer as $$
declare
  current_xp int;
  new_level int;
  new_title text;
begin
  select xp_total into current_xp from profiles where id = p_user_id;
  current_xp := coalesce(current_xp, 0) + p_xp;
  -- Calcular nível (cada nível = 500 XP base × nível)
  new_level := floor((-1 + sqrt(1 + 8 * current_xp / 500.0)) / 2) + 1;
  new_level := greatest(1, least(new_level, 20));
  -- Título por nível
  new_title := case
    when new_level < 3  then 'Recruta'
    when new_level < 5  then 'Consistente'
    when new_level < 8  then 'Focado'
    when new_level < 11 then 'Estrategista'
    when new_level < 15 then 'Imparável'
    else 'Antifrágil'
  end;
  update profiles
  set xp_total = current_xp, level = new_level, title = new_title
  where id = p_user_id;
end;
$$;

create or replace function update_streak(p_user_id uuid)
returns int language plpgsql security definer as $$
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

  return new_streak;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- VIEW: RESUMO SEMANAL
-- ────────────────────────────────────────────────────────────
create or replace view weekly_summary as
select
  hl.user_id,
  date_trunc('week', hl.date) as week_start,
  count(*) filter (where hl.completed) as habits_done,
  count(*) as habits_total,
  round(100.0 * count(*) filter (where hl.completed) / nullif(count(*), 0), 1) as consistency_pct,
  coalesce(sum(p.xp_total), 0) as xp_week
from habit_logs hl
join profiles p on p.id = hl.user_id
group by hl.user_id, week_start;

-- ────────────────────────────────────────────────────────────
-- PERFIL EXPANDIDO (adiciona colunas à tabela profiles)
-- ────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists age          int,
  add column if not exists sex          text check (sex in ('masculino','feminino','outro')),
  add column if not exists weight_kg    numeric(5,2),
  add column if not exists height_cm    int,
  add column if not exists goal_weight  numeric(5,2),
  add column if not exists water_goal_ml int default 2000,
  add column if not exists workouts_per_week int default 3,
  add column if not exists sleep_goal_h numeric(3,1) default 8,
  add column if not exists read_pages_day int default 10,
  -- Metas financeiras
  add column if not exists fin_monthly_save numeric(10,2),
  add column if not exists fin_debt_goal    numeric(10,2),
  add column if not exists fin_reserve_goal numeric(10,2),
  -- Metas pessoais (texto livre)
  add column if not exists goal_90_personal text,
  add column if not exists goal_90_career   text,
  add column if not exists goal_90_health   text,
  -- Config de XP e aceitação semanal
  add column if not exists xp_weekly_goal   int default 500,
  add column if not exists completion_pct_goal int default 80;

-- ────────────────────────────────────────────────────────────
-- LEMBRETES
-- ────────────────────────────────────────────────────────────
create table if not exists reminders (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  description text,
  time        time not null,          -- hora do lembrete
  days        int[] not null,         -- 0=Dom … 6=Sáb
  active      boolean default true,
  type        text default 'custom'   -- 'checkin_manha','checkin_tarde','checkin_noite','custom'
    check (type in ('checkin_manha','checkin_tarde','checkin_noite','habito','custom')),
  created_at  timestamptz default now()
);

alter table reminders enable row level security;
create policy "Lembretes próprios" on reminders
  for all using (auth.uid() = user_id);

-- Lembretes padrão inseridos no onboarding (chamado via função)
create or replace function create_default_reminders(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into reminders (user_id, title, time, days, type) values
    (p_user_id, 'Check-in da Manhã', '08:00', '{1,2,3,4,5,6,0}', 'checkin_manha'),
    (p_user_id, 'Check-in da Tarde', '14:00', '{1,2,3,4,5,6,0}', 'checkin_tarde'),
    (p_user_id, 'Check-in da Noite', '21:00', '{1,2,3,4,5,6,0}', 'checkin_noite')
  on conflict do nothing;
end;
$$;

-- Adiciona campo de poupança actual ao perfil
alter table profiles
  add column if not exists fin_current_savings numeric(12,2) default 0;

-- Coluna onboarded (se não existir ainda)
alter table profiles add column if not exists onboarded boolean default false;

-- Marcar utilizadores existentes como já onboarded
update profiles set onboarded = true where onboarded is false or onboarded is null;
