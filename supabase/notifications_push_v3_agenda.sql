-- ─────────────────────────────────────────────────────────────────────────────
-- NEXUS · Web Push v3 — notificações dos eventos da agenda
--
-- Os lembretes (recorrentes) já disparavam push; os eventos pontuais da agenda
-- não. Esta coluna marca o envio de cada evento para evitar duplicados, tal como
-- reminders.last_sent_at. A Edge Function send-reminders passa a percorrer também
-- a tabela agenda_events na hora local de cada utilizador.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.agenda_events
  add column if not exists notified_at timestamptz;
