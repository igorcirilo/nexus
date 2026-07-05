-- financas_gasto_reserva_v1.sql
--
-- Modelo "paga-te primeiro" para a poupança.
--
-- Antes: a categoria "Poupança" era uma transferência neutra — depositar ou
-- levantar não mexia no balanço do mês (receitas − despesas). O utilizador quer
-- que depositar reduza o balanço (poupar é pagar-se a si mesmo) e que gastar da
-- reserva não devolva dinheiro ao balanço.
--
-- Esta migração acrescenta o conceito de "despesa paga pela reserva": uma saída
-- normal (categoria real: Saúde, Transporte…) marcada com from_reserve = true.
-- Ela sai da RESERVA (não da conta corrente), aparece nos relatórios de gasto,
-- e NÃO volta a bater no balanço — porque esse dinheiro já saiu do balanço no
-- momento em que foi poupado (senão seria contado duas vezes).
--
-- Fluxo-conta (balanço): receita +, despesa −, depósito −, levantamento +,
--                        gasto-da-reserva 0.
-- Fluxo-reserva:         depósito +, levantamento −, gasto-da-reserva −.
--
-- Coluna nova, default false: todos os movimentos existentes mantêm o
-- comportamento atual (despesas normais). Idempotente.

alter table transactions
  add column if not exists from_reserve boolean not null default false;
