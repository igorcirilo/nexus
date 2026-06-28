-- ─────────────────────────────────────────────────────────────────────────
-- Finanças · Orçamentos v1 — persistência dos orçamentos por categoria.
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo: adiciona uma
-- coluna JSONB a `profiles`, não toca em dados existentes nem em RLS.
--
-- Antes, os orçamentos por categoria viviam apenas no localStorage do
-- navegador → não sincronizavam entre dispositivos e perdiam-se ao limpar
-- os dados do browser. Agora a fonte de verdade é o Supabase (como as metas
-- financeiras fin_monthly_save / fin_reserve_goal). O localStorage passa a ser
-- só cache offline, e os dados só-locais são migrados para cá no próximo login.
--
-- Formato: { "Alimentação": 400, "Transporte": 150, ... }  (valor em €/mês)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists fin_budgets jsonb not null default '{}'::jsonb;
