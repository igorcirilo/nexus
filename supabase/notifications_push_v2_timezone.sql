-- ─────────────────────────────────────────────────────────────────────────────
-- NEXUS · Web Push v2 — fuso horário por dispositivo
--
-- Guarda o fuso do dispositivo na subscrição. A Edge Function passa a disparar
-- os lembretes na hora local de cada utilizador, em vez de um fuso global.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.push_subscriptions
  add column if not exists timezone text;
