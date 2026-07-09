-- ─────────────────────────────────────────────────────────────────────────
-- Reminders One-off v1 — lembretes avulsos com data.
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo.
--
-- Até agora um lembrete era sempre recorrente (days = dias da semana).
-- O quick-add da página Hoje cria lembretes avulsos: date preenchida =
-- lembrete só para esse dia (days é ignorado); date null = recorrente,
-- comportamento antigo intacto.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.reminders add column if not exists date date;

create index if not exists reminders_user_date_idx on public.reminders (user_id, date) where date is not null;
