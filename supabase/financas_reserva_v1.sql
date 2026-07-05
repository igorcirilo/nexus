-- financas_reserva_v1.sql
--
-- Reserva de emergência derivada da poupança (fonte de verdade única).
--
-- Antes: profiles.fin_current_savings guardava a reserva como um número
-- independente, atualizado incrementalmente pela app a cada movimento de
-- "Poupança" (e editável à mão em dois sítios). Qualquer caminho falhado,
-- versão antiga ou gravação do perfil com snapshot desatualizado fazia a
-- reserva divergir da poupança real — depósitos entravam, levantamentos
-- não saíam, e vice-versa.
--
-- Depois: a reserva passa a ser SEMPRE calculada como
--
--   reserva = fin_savings_base + Σ(entradas "Poupança") − Σ(saídas "Poupança")
--
-- em que fin_savings_base representa o dinheiro poupado FORA do histórico
-- registado (saldo inicial + ajustes manuais). A app nunca mais escreve a
-- reserva a cada transação; escrever fin_savings_base só acontece quando o
-- utilizador ajusta o valor à mão (a app converte: base = valor − Σ líquido).
--
-- O backfill preserva o valor que cada utilizador vê hoje: base é calculada
-- de forma a que base + Σ líquido = fin_current_savings atual.
--
-- fin_current_savings fica como coluna legada (não é removida) para permitir
-- rollback e para versões antigas da app não partirem.

alter table profiles
  add column if not exists fin_savings_base numeric(12,2);

update profiles p
set fin_savings_base = coalesce(p.fin_current_savings, 0) - coalesce((
  select sum(case when t.type = 'entrada' then t.amount else -t.amount end)
  from transactions t
  where t.user_id = p.id
    and t.category = 'Poupança'
), 0)
where p.fin_savings_base is null;

-- Novos perfis começam com base 0 (reserva = só o que registarem).
alter table profiles
  alter column fin_savings_base set default 0;
