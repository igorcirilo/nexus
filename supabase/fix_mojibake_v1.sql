-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: corrigir mojibake nos dados existentes (item 12)
--
-- Contexto: texto UTF-8 foi gravado interpretado como Latin-1, produzindo
-- sequências como "Ã§" em vez de "ç". O código já foi corrigido na ORIGEM
-- (o import agora grava texto limpo — ver src/lib/text.ts e o uso em
-- src/lib/body-plan.ts), mas as linhas JÁ gravadas continuam corrompidas.
-- Esta migração repara essas linhas.
--
-- Segurança:
--   • Idempotente — pode ser reaplicada (só toca em linhas com marcadores Ã/Â).
--   • A função captura exceções: se a conversão falhar (ex.: texto com '✓' ou
--     '…' que não cabe em Latin-1), devolve o valor original sem o alterar.
--   • NÃO é aplicada automaticamente. Reveja o DRY-RUN antes do UPDATE.
--
-- Aplicar via Supabase MCP (apply_migration) ou no SQL editor do projeto.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Função de reparo: faz o round-trip Latin-1 -> UTF-8 com segurança.
create or replace function public.repair_mojibake(input text)
returns text
language plpgsql
immutable
as $$
begin
  if input is null then return null; end if;
  -- Só tenta reparar se houver marcadores típicos de mojibake.
  if input !~ '[ÃÂ]' then return input; end if;
  begin
    return convert_from(convert_to(input, 'LATIN1'), 'UTF8');
  exception when others then
    -- texto com chars fora do Latin-1 (ex.: ✓ …) — devolve original intacto
    return input;
  end;
end;
$$;

-- 2) DRY-RUN — execute primeiro para PRÉ-VISUALIZAR o que vai mudar.
--    (comente o bloco 3 enquanto valida)
-- select 'program_tasks.title' as campo, title as antes, public.repair_mojibake(title) as depois
--   from public.program_tasks where title ~ '[ÃÂ]'
-- union all
-- select 'program_tasks.description', description, public.repair_mojibake(description)
--   from public.program_tasks where description ~ '[ÃÂ]'
-- union all
-- select 'diet_plans.raw_content', left(raw_content::text, 80), left(public.repair_mojibake(raw_content::text), 80)
--   from public.diet_plans where raw_content::text ~ '[ÃÂ]'
-- limit 200;

-- 3) UPDATEs guardados — só atualizam linhas afetadas.

-- program_tasks (texto)
update public.program_tasks
   set title = public.repair_mojibake(title)
 where title ~ '[ÃÂ]';
update public.program_tasks
   set description = public.repair_mojibake(description)
 where description ~ '[ÃÂ]';

-- task_templates (texto)
update public.task_templates
   set title = public.repair_mojibake(title)
 where title ~ '[ÃÂ]';
update public.task_templates
   set description = public.repair_mojibake(description)
 where description ~ '[ÃÂ]';

-- diet_plans (texto + jsonb)
update public.diet_plans
   set title = public.repair_mojibake(title)
 where title ~ '[ÃÂ]';
update public.diet_plans
   set summary = public.repair_mojibake(summary)
 where summary ~ '[ÃÂ]';
update public.diet_plans
   set raw_content = public.repair_mojibake(raw_content::text)::jsonb
 where raw_content::text ~ '[ÃÂ]';

-- training_plans (texto + jsonb)
update public.training_plans
   set title = public.repair_mojibake(title)
 where title ~ '[ÃÂ]';
update public.training_plans
   set summary = public.repair_mojibake(summary)
 where summary ~ '[ÃÂ]';
update public.training_plans
   set raw_content = public.repair_mojibake(raw_content::text)::jsonb
 where raw_content::text ~ '[ÃÂ]';

-- diet_meals / training_entries: as notas podem conter texto importado.
update public.diet_meals
   set notes = public.repair_mojibake(notes)
 where notes ~ '[ÃÂ]';
update public.training_entries
   set notes = public.repair_mojibake(notes)
 where notes ~ '[ÃÂ]';

-- 4) (opcional) remover a função auxiliar após a migração:
-- drop function if exists public.repair_mojibake(text);
