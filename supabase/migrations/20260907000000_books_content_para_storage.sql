-- Move o texto dos livros do Postgres para o Storage.
--
-- PORQUÊ: `books.raw_content` guardava o livro inteiro DUAS vezes —
--   • `pages`          → texto de cada página
--   • `extractedText`  → o mesmo texto, concatenado
-- Um PDF de algumas centenas de páginas dá vários MB por livro, dentro do
-- disco do Postgres. E `extractedText` nunca chegava a ser lido de volta: só
-- serve no momento do import (pré-visualização e deteção do sumário).
--
-- Passa a ficar na tabela apenas o que é pequeno e realmente consultado —
-- pageCount, toc, tocAuto — e as páginas vão para um bucket, que não pesa no
-- disco da base de dados.
--
-- Compatibilidade: livros antigos continuam com as páginas em `raw_content` e
-- `content_path` a NULL; o leitor trata os dois casos. Nada é apagado aqui.

alter table public.books
  add column if not exists content_path text;

comment on column public.books.content_path is
  'Caminho no bucket book-content (user_id/book_id.json) com as páginas. NULL = livro antigo, páginas ainda em raw_content.';

-- Bucket privado: o conteúdo é pessoal e só o dono lê.
insert into storage.buckets (id, name, public)
values ('book-content', 'book-content', false)
on conflict (id) do nothing;

-- Isolamento por utilizador: o primeiro segmento do caminho é o user_id, tal
-- como escrito por bookContentPath() em src/lib/book-content.ts.
drop policy if exists "book_content_select_own" on storage.objects;
create policy "book_content_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-content'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "book_content_insert_own" on storage.objects;
create policy "book_content_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'book-content'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "book_content_update_own" on storage.objects;
create policy "book_content_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'book-content'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "book_content_delete_own" on storage.objects;
create policy "book_content_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'book-content'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
