-- NEXUS — Fase 1
-- Correções críticas: agenda_events + weekly_challenges
-- Executar no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_challenges_user_week_idx
  on public.weekly_challenges (user_id, week_start desc);

alter table public.weekly_challenges enable row level security;

-- agenda_events: endurece schema sem refactor destrutivo
alter table if exists public.agenda_events
  add column if not exists description text,
  add column if not exists end_time text,
  add column if not exists color text not null default '#E8A838',
  add column if not exists all_day boolean not null default false;

alter table if exists public.agenda_events enable row level security;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_events'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agenda_events' AND policyname = 'agenda events select own'
    ) THEN
      CREATE POLICY "agenda events select own"
        ON public.agenda_events
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agenda_events' AND policyname = 'agenda events insert own'
    ) THEN
      CREATE POLICY "agenda events insert own"
        ON public.agenda_events
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agenda_events' AND policyname = 'agenda events update own'
    ) THEN
      CREATE POLICY "agenda events update own"
        ON public.agenda_events
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'agenda_events' AND policyname = 'agenda events delete own'
    ) THEN
      CREATE POLICY "agenda events delete own"
        ON public.agenda_events
        FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_challenges' AND policyname = 'weekly challenges select own'
  ) THEN
    CREATE POLICY "weekly challenges select own"
      ON public.weekly_challenges
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_challenges' AND policyname = 'weekly challenges insert own'
  ) THEN
    CREATE POLICY "weekly challenges insert own"
      ON public.weekly_challenges
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_challenges' AND policyname = 'weekly challenges update own'
  ) THEN
    CREATE POLICY "weekly challenges update own"
      ON public.weekly_challenges
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_challenges' AND policyname = 'weekly challenges delete own'
  ) THEN
    CREATE POLICY "weekly challenges delete own"
      ON public.weekly_challenges
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
