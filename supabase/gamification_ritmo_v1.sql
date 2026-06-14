-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: Redesign da gamificação — remover XP, introduzir "Ritmo"
--
-- O XP (auto-reportado e arbitrário) deixa de ser a métrica-herói. A progressão
-- de identidade (nível/título) passa a derivar do MELHOR streak (consistência
-- sustentada) e a Liga semanal passa a contar PONTOS DE CONSISTÊNCIA em vez de
-- XP. Esta migração é idempotente — pode ser reaplicada com segurança.
--
-- Aplicar via Supabase MCP (apply_migration) ou no SQL editor do projeto.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Liga semanal: renomear coluna xp → points (preserva dados existentes).
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weekly_league_snapshots'
      and column_name = 'xp'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weekly_league_snapshots'
      and column_name = 'points'
  ) then
    alter table public.weekly_league_snapshots rename column xp to points;
  end if;
end $$;

-- Índice de ranking por pontos.
drop index if exists public.weekly_league_snapshots_week_start_idx;
create index if not exists weekly_league_snapshots_week_start_idx
  on public.weekly_league_snapshots (week_start, points desc, updated_at);

-- 2) Nova função: recompute_level — nível (1–6) e título a partir do streak_best.
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
  update profiles set level = new_level, title = new_title where id = p_user_id;
end;
$function$;

-- 3) update_streak: passa a recalcular nível/título no fim.
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

-- 4) Remover a função antiga de XP.
drop function if exists public.add_xp(uuid, integer);

-- 5) Backfill: recalcular nível/título de todos os perfis a partir do streak_best.
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.recompute_level(r.id);
  end loop;
end $$;

-- 6) Catálogo de conquistas rebaseado (sem badges de XP).
insert into public.badges (key, name, description, icon) values
  ('primeiro_checkin', 'Primeira Vez', 'O teu primeiro check-in.', '🌅'),
  ('streak_7',         'Uma Semana',   '7 dias de ofensiva seguidos.', '🔥'),
  ('streak_21',        'Três Semanas', '21 dias de ofensiva seguidos.', '⚡'),
  ('streak_100',       'Centenário',   '100 dias de ofensiva seguidos.', '💎'),
  ('ritmo_80',         'Em Chamas',    'Atingiste um Ritmo de 80 ou mais.', '🚀'),
  ('consistencia_30',  'Inabalável',   'A tua melhor ofensiva chegou aos 30 dias.', '🏔️')
on conflict (key) do nothing;
