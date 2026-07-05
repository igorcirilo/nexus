-- financas_categorias_v1.sql
--
-- Gestão de categorias no orçamento + contas fixas.
--
-- 1) fin_categories: categorias de saída criadas pelo utilizador diretamente no
--    orçamento (nome + emoji). Antes, uma categoria personalizada só existia se
--    houvesse um movimento com ela ("Personalizar"); agora podem ser criadas,
--    renomeadas e apagadas de forma persistente. Formato: array de
--    { "name": string, "emoji": string }.
--
-- 2) fin_fixed_cats: nomes de categorias marcadas como "conta fixa" (valor
--    previsível, ex.: Renda). Para estas, atingir 100% do orçamento é o normal
--    e não dispara o aviso "atenção" — só avisa se ultrapassar.
--
-- Ambas jsonb com default '[]'. Idempotente. Sem migração aplicada, a app cai
-- em [] e mantém o comportamento anterior.

alter table profiles
  add column if not exists fin_categories jsonb not null default '[]'::jsonb;

alter table profiles
  add column if not exists fin_fixed_cats jsonb not null default '[]'::jsonb;
