-- ─────────────────────────────────────────────────────────────────────────
-- Day Item Checks v1 — "Lembretes de hoje" na página Hoje.
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo: cria uma
-- tabela nova com RLS por utilizador, não toca em dados existentes.
--
-- Guarda o check-off diário de lembretes recorrentes (reminders) e eventos
-- da agenda (agenda_events), espelhando o padrão de habit_logs: uma linha
-- por (utilizador, tipo, item, data). O check é apenas organizacional — não
-- alimenta ofensiva, Ritmo nem badges.
--
-- Sem FK para o item pai (dois pais possíveis); linhas órfãs após apagar o
-- lembrete/evento são inertes: só são lidas em junção com os itens vivos.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.day_item_checks (
  id           uuid not null default gen_random_uuid(),
  user_id      uuid not null,
  item_type    text not null,
  item_id      uuid not null,
  date         date not null,
  completed    boolean not null default true,
  completed_at timestamptz not null default now(),
  constraint day_item_checks_pkey primary key (id),
  constraint day_item_checks_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint day_item_checks_type_check check (item_type in ('reminder', 'event')),
  constraint day_item_checks_unique unique (user_id, item_type, item_id, date)
);

create index if not exists day_item_checks_user_date_idx on public.day_item_checks (user_id, date);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.day_item_checks enable row level security;

create policy day_item_checks_select_own on public.day_item_checks for select using (auth.uid() = user_id);
create policy day_item_checks_insert_own on public.day_item_checks for insert with check (auth.uid() = user_id);
create policy day_item_checks_update_own on public.day_item_checks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy day_item_checks_delete_own on public.day_item_checks for delete using (auth.uid() = user_id);
