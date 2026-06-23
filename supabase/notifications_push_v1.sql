-- ─────────────────────────────────────────────────────────────────────────────
-- NEXUS · Web Push — schema + agendador
--
-- Cria a tabela de subscrições push, evita envios duplicados e agenda o disparo
-- via pg_cron → pg_net → Edge Function `send-reminders` (a cada minuto).
--
-- Tudo dentro do free tier do Supabase. O cron do Vercel Hobby (1×/dia) NÃO é
-- usado; o pg_cron do Supabase corre a cada minuto sem custo.
--
-- ANTES DE CORRER: substituir <PROJECT_REF> e <CRON_SECRET> (passo 3).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Subscrições push do browser (uma linha por dispositivo/endpoint) ──────────
create table if not exists public.push_subscriptions (
  id         uuid not null default gen_random_uuid(),
  user_id    uuid not null,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- O utilizador só vê/gere as próprias subscrições. A Edge Function usa a
-- service_role key, que ignora RLS, para ler todas e enviar.
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 2) Anti-duplicação: marca o último envio de cada lembrete ────────────────────
alter table public.reminders
  add column if not exists last_sent_at timestamptz;

-- 3) Agendador: pg_cron chama a Edge Function a cada minuto ────────────────────
--    Extensões disponíveis no plano free.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- IMPORTANTE: substituir <PROJECT_REF> pelo ref do projeto e <CRON_SECRET> pelo
-- mesmo valor configurado no secret CRON_SECRET da Edge Function.
-- Para re-agendar com valores diferentes, correr antes:
--   select cron.unschedule('nexus-send-reminders');
select cron.schedule(
  'nexus-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
