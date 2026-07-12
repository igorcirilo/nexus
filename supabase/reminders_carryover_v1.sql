-- ─────────────────────────────────────────────────────────────────────────
-- Reminders Carry-over v1 — lembretes avulsos persistem até o check.
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo.
--
-- Um lembrete avulso (date preenchida) que não recebeu check deixava de
-- aparecer no dia seguinte. Agora ele "carrega" dia após dia até ser
-- concluído: completed_at marca a conclusão definitiva do avulso (o check
-- diário em day_item_checks continua a existir para o estado visual do dia).
-- Recorrentes (date null) não usam esta coluna.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.reminders add column if not exists completed_at timestamptz;

-- Backfill: avulsos já marcados no passado (via day_item_checks) recebem a
-- conclusão definitiva, senão voltariam a aparecer como pendentes carregados.
update public.reminders r
set completed_at = coalesce(c.completed_at, now())
from public.day_item_checks c
where r.completed_at is null
  and r.date is not null
  and c.user_id = r.user_id
  and c.item_type = 'reminder'
  and c.item_id = r.id
  and c.completed;
