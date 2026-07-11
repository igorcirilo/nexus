-- ─────────────────────────────────────────────────────────────────────────
-- Book Progress Furthest v1 — releitura não conta como páginas lidas.
--
-- Aplicar no SQL Editor do Supabase (projeto Nexus). É aditivo.
--
-- pages_read de uma sessão era `página_final − página_inicial`: voltar atrás
-- e reler inflava o total. furthest_page é a marca-d'água da página mais
-- avançada já alcançada no livro; só o avanço além dela gera pages_read.
-- current_page continua a ser o marcador livre de posição (pode recuar).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.book_progress add column if not exists furthest_page integer;

update public.book_progress set furthest_page = current_page where furthest_page is null;
