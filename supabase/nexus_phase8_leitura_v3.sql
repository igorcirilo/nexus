-- NEXUS — Fase 8: Leitura V3 (base completa de reader)

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text null,
  source_file_name text null,
  cover_label text null,
  raw_content jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.book_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  current_page integer not null default 1,
  progress_pct numeric(5,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, book_id)
);

create table if not exists public.book_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page integer not null,
  color text not null default '#E8A838',
  excerpt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.book_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page integer not null,
  note text not null,
  excerpt text null,
  created_at timestamptz not null default now()
);

create table if not exists public.book_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page integer not null,
  label text null,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text not null default 'sepia',
  reading_mode text not null default 'paginado',
  font_scale numeric(4,2) not null default 1,
  line_height numeric(4,2) not null default 1.8,
  margin_px integer not null default 24,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.books enable row level security;
alter table public.book_progress enable row level security;
alter table public.book_highlights enable row level security;
alter table public.book_notes enable row level security;
alter table public.book_bookmarks enable row level security;
alter table public.reading_preferences enable row level security;

do $$ begin
  create policy books_select_own on public.books for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy books_insert_own on public.books for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy books_update_own on public.books for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy books_delete_own on public.books for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy book_progress_select_own on public.book_progress for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_progress_insert_own on public.book_progress for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_progress_update_own on public.book_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_progress_delete_own on public.book_progress for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy book_highlights_select_own on public.book_highlights for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_highlights_insert_own on public.book_highlights for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_highlights_update_own on public.book_highlights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_highlights_delete_own on public.book_highlights for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy book_notes_select_own on public.book_notes for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_notes_insert_own on public.book_notes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_notes_update_own on public.book_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_notes_delete_own on public.book_notes for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy book_bookmarks_select_own on public.book_bookmarks for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_bookmarks_insert_own on public.book_bookmarks for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_bookmarks_update_own on public.book_bookmarks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy book_bookmarks_delete_own on public.book_bookmarks for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy reading_preferences_select_own on public.reading_preferences for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy reading_preferences_insert_own on public.reading_preferences for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy reading_preferences_update_own on public.reading_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy reading_preferences_delete_own on public.reading_preferences for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists idx_books_user_id on public.books(user_id, created_at desc);
create index if not exists idx_book_progress_user_book on public.book_progress(user_id, book_id);
create index if not exists idx_book_highlights_user_book on public.book_highlights(user_id, book_id, page);
create index if not exists idx_book_notes_user_book on public.book_notes(user_id, book_id, page);
create index if not exists idx_book_bookmarks_user_book on public.book_bookmarks(user_id, book_id, page);

-- Alinha os defaults com o fallback do reader (paginado/1.8/24). Como a tabela
-- é criada com `if not exists`, estes ALTERs corrigem instâncias já
-- implantadas ao re-executar o ficheiro. Só afetam inserções sem estas
-- colunas — as linhas existentes mantêm os valores já escolhidos pelo utilizador.
alter table public.reading_preferences alter column reading_mode set default 'paginado';
alter table public.reading_preferences alter column line_height set default 1.8;
alter table public.reading_preferences alter column margin_px set default 24;
