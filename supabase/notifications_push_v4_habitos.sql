-- ─────────────────────────────────────────────────────────────────────────────
-- NEXUS · Web Push v4 — notificações dos hábitos
--
-- Os hábitos passam a notificar à hora extraída do campo time_window
-- (ex. '07:00-09:00' → 07:00). Esta coluna marca o último envio de cada hábito
-- para evitar duplicados dentro do mesmo minuto, tal como reminders.last_sent_at.
--
-- Hábitos cujo time_window não tenha uma hora (ex. 'Manhã', 'Todo o dia') não
-- são notificados — não há hora fiável para disparar.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.habits
  add column if not exists last_notified_at timestamptz;
