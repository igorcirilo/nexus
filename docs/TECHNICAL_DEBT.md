# NEXUS — Dívida Técnica, Riscos e Recomendações

> Baseado em análise de código. Só estão listados itens sustentados por
> evidência. Legenda: **[C]** confirmado · **[I]** inferência · **[?]** a confirmar.

## Críticos

### 1. Schema de BD incompleto no repositório — ✅ RESOLVIDO (2026-07-18)
- **Estado atual:** `supabase/schema_completo.sql` foi regenerado por
  introspecção do projeto de produção e cobre as **38 tabelas** reais,
  constraints, índices, as 96 RLS policies, funções e triggers. Uma cópia
  idêntica vive em `supabase/migrations/20260718000000_baseline_schema.sql`
  como baseline no formato da CLI/MCP. Processo de manutenção documentado em
  `supabase/README.md`. **[C]**
- **Correções ao diagnóstico original:** o ficheiro `schema_completo.sql` já
  existia no repo (dump de 2026-07-11), mas estava desatualizado — faltavam
  5 tabelas (`reading_sessions`, `push_subscriptions`, `quit_habits`,
  `quit_relapses`, `recurring_rules`) e colunas recentes
  (`book_progress.furthest_page`, `reminders.completed_at`). A RPC `add_xp`
  **não existe** no banco e o código não a chama (só `update_streak`).
- **Risco remanescente (processo):** manter `supabase/migrations/` em sync —
  toda mudança de schema deve ir via `apply_migration` + ficheiro no repo no
  mesmo commit (ver `supabase/README.md`); o padrão "colar no SQL Editor"
  está descontinuado.

## Altos

### 2. RLS não auditável a partir do repo — ✅ versionada / ⚠ revisão pendente
- **Estado atual:** as 96 policies estão versionadas no dump/baseline
  (2026-07-18). Todas as 38 tabelas têm RLS ativo. **[C]**
- **Pontos a rever (agora auditáveis):** `weekly_league_snapshots` tem
  `select ... using (true)` para authenticated (by design da liga, mas expõe
  username/level/points de todos); `reminders` e `transactions` têm policies
  redundantes (ALL + granulares); `badges` e `task_templates` têm RLS ativo
  sem policy nenhuma (leitura pelo app é negada — confirmar se é intencional).
- **Recomendação:** revisar esses quatro casos; qualquer ajuste via migration.

### 3. `src/lib/supabase.ts` monolítico (~1090 linhas)
- **Evidência:** um único módulo concentra o acesso a dados de todos os domínios. **[C]**
- **Impacto:** alto acoplamento, difícil de testar e manter.
- **Recomendação:** dividir por domínio (`lib/data/habits.ts`, `.../finance.ts`,
  `.../program.ts`, etc.).

## Médios

### 4. Ausência de CI
- **Evidência:** sem `.github/workflows`. **[C]**
- **Impacto:** lint/typecheck/test/build não correm automaticamente → regressões.
- **Recomendação:** GitHub Actions com `install → lint → typecheck → test → build`.

### 5. Cobertura de testes estreita
- **Evidência:** 40 testes, só engines puros; zero testes de UI/integração
  (apesar de `@testing-library/react` instalado). **[C]**
- **Recomendação:** testar componentes-chave (corpo, import financeiro) e o fluxo
  onboarding→programa.

### 6. `next-pwa@5.6.0` desatualizado (workbox antigo)
- **Evidência:** findings remanescentes de `npm audit` vêm desta árvore de deps. **[C]**
- **Impacto:** vulnerabilidades em tooling de build (fora do runtime).
- **Recomendação:** avaliar upgrade do `next-pwa` ou alternativa de PWA.

### 7. Múltiplos clientes Supabase
- **Evidência:** `lib/supabase.ts` + `createClient` inline em 3 páginas
  (`analise-inicial`, `onboarding-v2`, `programa`). **[C]**
- **Impacto:** risco do aviso "Multiple GoTrueClient instances".
- **Recomendação:** consolidar no cliente único exportado por `lib/supabase.ts`.

## Baixos

- **Inconsistência de estilo:** estilos inline extensos vs Tailwind subutilizado. **[C]**
- **Documentação histórica dispersa/parcialmente desatualizada** (`GIT_CLEANUP.md`,
  `docs/handoff/*`). **[C]**
- **Peso do repo:** `docs/rise-reference/` contém muitas imagens. **[C]**

## Segurança

- **Existem arquivos de configuração sensíveis** (`.env.local`, ignorado). Não
  inspecionados/expostos. O `.env.local.example` foi sanitizado (placeholders).
- A chave `NEXT_PUBLIC_SUPABASE_ANON_KEY` é **pública por design**; a segurança
  real depende das RLS (ver item 2).
- **Recomendação:** rotacionar a chave que esteve no `.env.example` e auditar RLS.

## Perguntas em aberto

1. ~~Onde está o schema completo da BD + RPCs?~~ Respondida: extraído do
   projeto de produção e versionado em 2026-07-18 (ver item 1).
2. ~~As RLS das tabelas centrais existem e estão corretas?~~ Existem e estão
   versionadas; revisão dos 4 casos sinalizados no item 2 continua pendente.
3. Vercel é o alvo de deploy? Há projeto/preview configurado? **[?]**
4. O produto é single-user pessoal ou multi-utilizador/SaaS? (a liga semanal
   sugere multi-user). **[?]**
5. Os seeds (ex.: `task_templates`) estão completos para o programa funcionar? **[?]**

## Próximos passos recomendados (prioridade)

1. ~~Versionar schema completo + RPCs + RLS como migrations.~~ ✅ 2026-07-18.
2. Adicionar CI (lint/typecheck/test/build).
3. Refatorar `supabase.ts` por domínio e consolidar o cliente único.
4. Ampliar testes (UI/integração).
5. Rever segurança (rotacionar chave, rever os 4 casos de RLS do item 2,
   mover o CRON_SECRET do job pg_cron para o Supabase Vault).
6. Avaliar upgrade do `next-pwa`/workbox.
