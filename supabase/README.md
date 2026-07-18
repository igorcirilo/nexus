# Supabase — schema e migrations

Projeto de produção: `jsslyritdivjtsiwdorm` ("Nexus Project").

## Fonte de verdade

- **`schema_completo.sql`** — dump fiel e completo do schema de produção
  (38 tabelas, 96 RLS policies, funções e triggers), regenerado por
  introspecção dos catálogos do Postgres em **2026-07-18**. Serve para
  recriar a base de dados num projeto Supabase novo/vazio.
- **`migrations/20260718000000_baseline_schema.sql`** — cópia idêntica do
  dump, no formato de migrations que a CLI/MCP do Supabase reconhece. É o
  ponto zero ("baseline") do histórico versionado no repo.

O banco de produção já tem 20 migrations registadas em
`supabase_migrations.schema_migrations` (de `create_body_measurements` a
`book_progress_furthest_v1`); todas estão **incluídas** no baseline — não é
preciso (nem se deve) reaplicá-las.

## Como alterar o schema a partir de agora

1. Aplicar a mudança no projeto live via `apply_migration` (MCP do Supabase)
   ou pela CLI (`supabase migration up`) — ambos registam a versão em
   `schema_migrations` automaticamente.
2. Guardar o mesmo SQL no repo como
   `supabase/migrations/<YYYYMMDDHHMMSS>_<nome>.sql`, no **mesmo commit** da
   mudança de código que depende dele.

O padrão antigo — colar SQL manualmente no SQL Editor e deixar um ficheiro
solto em `supabase/*.sql` — está **descontinuado**: não regista a versão e
foi o que causou o drift entre repo e produção.

## Ficheiros soltos `supabase/*.sql` (legado)

Os ficheiros na raiz de `supabase/` (ex.: `quit_habits_v1.sql`,
`financas_recurring_v1.sql`, `notifications_push_v*.sql`, …) são o registo
histórico de mudanças aplicadas manualmente no SQL Editor. **Já estão todos
refletidos no baseline — não re-executar.** Ficam apenas como documentação
(os cabeçalhos explicam o porquê de cada mudança).

## O que NÃO está no dump

- **Dados** (linhas) — o dump é só estrutura. Seeds de `badges` e
  `task_templates` precisam de ser inseridos à parte.
- **Job do pg_cron** que chama a Edge Function `send-reminders` — contém um
  secret e por isso não é versionado; ver `docs/NOTIFICACOES_AGENDADAS.md`
  para o recriar (idealmente movendo o secret para o Supabase Vault).
- **Configuração de Auth** (providers, redirect URLs) — ver
  `SUPABASE_AUTH_CONFIG.md`.
- **Edge Functions** — vivem em `supabase/functions/` e são deployadas à
  parte (`supabase functions deploy`).

## Notas de fidelidade

- A RPC `add_xp` mencionada em docs antigos **não existe** no banco e o
  código não a chama (só `update_streak`, em `src/lib/supabase.ts`).
- `reminders` e `transactions` têm policies redundantes (uma `for all` +
  quatro granulares) — o dump é fiel ao que existe; consolidar é melhoria
  futura.
- `badges` e `task_templates` têm RLS ativo **sem policies**: nenhum acesso
  anon/authenticated; escrita só via service role.
