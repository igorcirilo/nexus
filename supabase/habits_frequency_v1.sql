-- ─────────────────────────────────────────────────────────────────────────
-- Hábitos · Frequência v1 — agendar hábitos por dia da semana.
--
-- Aditiva: adiciona a coluna `days` (int[]) a `habits`. Não toca em dados
-- existentes (hábitos antigos ficam com days = NULL = todos os dias).
--
-- Semântica: NULL ou vazio = todos os dias. Caso contrário, lista de dias da
-- semana em que o hábito é devido — 0=Domingo … 6=Sábado (mesma convenção de
-- reminders.days e de JavaScript Date.getDay()).
--
-- Exemplos:  {1,3,5} = Seg/Qua/Sex (3x por semana)   {0,6} = fim de semana
-- ─────────────────────────────────────────────────────────────────────────

alter table public.habits
  add column if not exists days int[] null;
