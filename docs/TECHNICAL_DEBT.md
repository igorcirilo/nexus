# NEXUS — Dívida Técnica, Riscos e Recomendações

> Baseado em análise de código. Só estão listados itens sustentados por
> evidência. Legenda: **[C]** confirmado · **[I]** inferência · **[?]** a confirmar.

## Críticos

### 1. Schema de BD incompleto no repositório
- **Evidência:** o código referencia **28 tabelas** via `.from(...)` + as RPCs
  `add_xp` e `update_streak`, mas `supabase/*.sql` versiona apenas ~13 tabelas
  (leitura + programa). `GIT_CLEANUP.md` menciona um `supabase/schema_completo.sql`
  que **não está presente**. **[C]**
- **Faltam:** `profiles, habits, habit_logs, checkins, transactions,
  focus_sessions, user_badges, weekly_league_snapshots, training_plans,
  training_entries, diet_plans, diet_meals, body_measurements, agenda_events,
  goal_milestones, reminders` + funções `add_xp`/`update_streak`.
- **Impacto:** impossível recriar o ambiente do zero; risco de drift código↔BD.
- **Recomendação:** recuperar/recriar o schema completo + RPCs e versionar como
  migrations Supabase (`supabase/migrations`).

## Altos

### 2. RLS não auditável a partir do repo
- **Evidência:** as políticas das tabelas centrais não estão versionadas. **[C/?]**
- **Impacto:** não é possível garantir o isolamento por utilizador; segurança
  depende inteiramente de RLS que não vivem no código.
- **Recomendação:** versionar e revisar todas as policies; confirmar que nenhuma
  tabela exposta à chave anon fica sem policy.

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

1. Onde está o schema completo da BD + RPCs? Existe num Supabase remoto? **[?]**
2. As RLS das tabelas centrais existem e estão corretas? **[?]**
3. Vercel é o alvo de deploy? Há projeto/preview configurado? **[?]**
4. O produto é single-user pessoal ou multi-utilizador/SaaS? (a liga semanal
   sugere multi-user). **[?]**
5. Os seeds (ex.: `task_templates`) estão completos para o programa funcionar? **[?]**

## Próximos passos recomendados (prioridade)

1. Versionar schema completo + RPCs + RLS como migrations.
2. Adicionar CI (lint/typecheck/test/build).
3. Refatorar `supabase.ts` por domínio e consolidar o cliente único.
4. Ampliar testes (UI/integração).
5. Rever segurança (rotacionar chave, auditar RLS).
6. Avaliar upgrade do `next-pwa`/workbox.
