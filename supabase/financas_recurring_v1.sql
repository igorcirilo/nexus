-- ─────────────────────────────────────────────────────────────────────────
-- Finanças · Recorrentes v1 — receitas/despesas que se repetem todos os meses
-- (renda, salário, prestações, assinaturas).
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo: cria uma
-- tabela nova com RLS por utilizador e acrescenta uma coluna opcional a
-- `transactions` para ligar cada lançamento à regra que o originou. Não toca
-- em dados existentes.
--
-- Modelo de uso: a regra guarda o dia do mês em que a conta acontece. A app
-- NÃO lança nada sozinha — mostra as recorrências "por pagar" do mês e o
-- utilizador confirma cada uma (mantém o controlo e serve de contas a pagar).
-- Ao confirmar, cria-se uma transação normal com `recurring_id` a apontar
-- para a regra, o que permite saber que aquela recorrência já foi lançada
-- neste mês.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.recurring_rules (
  id           uuid not null default gen_random_uuid(),
  user_id      uuid not null,
  type         text not null,
  category     text not null,
  description  text,
  amount       numeric(10,2) not null,
  day_of_month integer not null default 1,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint recurring_rules_pkey primary key (id),
  constraint recurring_rules_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint recurring_rules_type_check check (type = any (array['entrada','saida'])),
  constraint recurring_rules_amount_check check (amount > 0),
  -- 1–28 para existir em qualquer mês (evita saltos em fevereiro/meses curtos).
  constraint recurring_rules_day_check check (day_of_month between 1 and 28)
);

create index if not exists recurring_rules_user_idx on public.recurring_rules (user_id);

-- Liga uma transação à recorrência que a originou (opcional). ON DELETE SET
-- NULL: apagar a regra não apaga o histórico já lançado.
alter table public.transactions
  add column if not exists recurring_id uuid references public.recurring_rules(id) on delete set null;

create index if not exists transactions_recurring_idx on public.transactions (recurring_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.recurring_rules enable row level security;

create policy recurring_rules_select_own on public.recurring_rules for select using (auth.uid() = user_id);
create policy recurring_rules_insert_own on public.recurring_rules for insert with check (auth.uid() = user_id);
create policy recurring_rules_update_own on public.recurring_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_rules_delete_own on public.recurring_rules for delete using (auth.uid() = user_id);
