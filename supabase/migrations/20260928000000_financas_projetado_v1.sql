-- ─────────────────────────────────────────────────────────────────────────
-- Finanças · Projetado v1 — valores a receber e a pagar a pessoas
-- (empréstimos, contas divididas, reembolsos, vendas…).
--
-- Aditivo: cria a tabela `projections` com RLS por utilizador e acrescenta
-- `transactions.projection_id`. Não toca em dados existentes.
--
-- Modelo: a projeção guarda QUEM, QUANTO e em que DIREÇÃO ('receber' = tenho
-- dinheiro com alguém; 'pagar' = devo a alguém). O que já foi recebido/pago
-- NÃO é guardado aqui: deriva das transações ligadas (`projection_id`) na
-- categoria reservada "Projetado", que é uma transferência (mexe no balanço
-- da conta, mas não é gasto nem rendimento). Assim cada abatimento parcial
-- é um movimento normal, com data, e o saldo em aberto nunca diverge deles.
--   · receber: abertura (opcional) = saída; abatimento = entrada
--   · pagar:   abertura (opcional) = entrada; abatimento = saída
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.projections (
  id          uuid not null default gen_random_uuid(),
  user_id     uuid not null,
  direction   text not null,
  person      text not null,
  reason      text not null default 'emprestimo',
  description text,
  amount      numeric(10,2) not null,
  date        date not null default current_date,
  due_date    date,
  created_at  timestamptz not null default now(),
  constraint projections_pkey primary key (id),
  constraint projections_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint projections_direction_check check (direction = any (array['receber','pagar'])),
  constraint projections_reason_check check (reason = any (array['emprestimo','divisao','reembolso','venda','outro'])),
  constraint projections_amount_check check (amount > 0),
  constraint projections_person_check check (length(btrim(person)) > 0)
);

create index if not exists projections_user_idx on public.projections (user_id);

-- ON DELETE SET NULL: apagar a projeção não apaga movimentos sozinho (a app
-- pergunta e apaga os ligados explicitamente).
alter table public.transactions
  add column if not exists projection_id uuid references public.projections(id) on delete set null;

-- Parcial: a esmagadora maioria das transações não tem projeção.
create index if not exists transactions_projection_idx
  on public.transactions (projection_id) where projection_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.projections enable row level security;

create policy projections_select_own on public.projections for select using (auth.uid() = user_id);
create policy projections_insert_own on public.projections for insert with check (auth.uid() = user_id);
create policy projections_update_own on public.projections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projections_delete_own on public.projections for delete using (auth.uid() = user_id);
