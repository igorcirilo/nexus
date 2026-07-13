# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

**NEXUS** é um PWA de desenvolvimento pessoal gamificado (hábitos, check-ins,
programa de 63 dias, treino/dieta/peso, finanças, leitura, objetivos,
calendário/lembretes, XP/streaks/badges/liga semanal), em **Next.js 14 (App
Router) + TypeScript + Supabase**. Todo o produto e a UI são em **português
(pt-PT)** — escreve textos de UI, commits e docs em português.

## Comandos

```bash
npm run dev          # dev server na porta 3001 (não 3000)
npm run build        # next build (gera também o SW do PWA em public/)
npm start            # serve o build de produção na porta 3001
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
npm test             # vitest run (suite completa, uma vez)
npm run test:watch   # vitest em watch mode
npx vitest run src/lib/__tests__/ritmo.test.ts   # um único ficheiro de teste
```

Não há CI — corre `lint`, `typecheck` e `test` localmente antes de terminar.

Env: `cp .env.local.example .env.local` e preenche `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (embutidas no bundle em build time).

## Tipografia (REGRA PERMANENTE)

- A fonte **Syne está BANIDA** deste projeto (decisão de design, 2026-07-12).
  **Nunca** a use — nem em `fontFamily` inline, nem no import do Google Fonts
  em `src/app/globals.css`, nem no `tailwind.config.ts`.
- Papéis atuais:
  - **Inter** (pesos 700–900): display, títulos, números de destaque.
  - **DM Sans**: corpo e texto corrido.

## Arquitetura

Aplicação **client-heavy sem backend próprio**: não há API routes — o Supabase
(Postgres + Auth + RLS + RPC) é o backend, chamado diretamente do browser.

```
Páginas ('use client', src/app/**/page.tsx)
  → Componentes (src/components/**, organizados por domínio: corpo/, financas/, hoje/, leitura/, …)
  → Engines puros (src/lib/*) + acesso a dados (src/lib/supabase.ts)
  → Supabase  |  localStorage (draft de onboarding, cargas de treino)
```

- **Regra de negócio vive em `src/lib/`** como funções puras testáveis
  (`onboarding-engine.ts`, `program-engine.ts`, `assessment-to-program.ts`,
  `mentor.ts`, `ritmo.ts`, `pdf.ts`/`spreadsheet.ts`/`csv-parser.ts`, etc.).
  Lógica nova de domínio deve seguir este padrão: função pura em `src/lib` +
  teste em `src/lib/__tests__`, com a página apenas a orquestrar.
- **Acesso a dados centralizado em `src/lib/supabase.ts`** (monolito ~1090
  linhas — usa o cliente exportado daí; não cries `createClient` inline em
  páginas). `supabase-server.ts` existe para o pouco código server-side.
- **Estado:** sem Redux/Zustand/React Query. Cada página faz fetch no
  `useEffect`; Context só para Toasts (`components/Toast.tsx` +
  `lib/toast-events.ts` via eventos `window`).
- **Tipos das entidades** em `src/types/index.ts`. Domínio central: 7 áreas de
  vida (`HabitArea`): corpo, produtividade, idiomas, carreira, financas,
  emocoes, relacionamentos.
- **Gamificação via RPCs** Supabase: `add_xp` e `update_streak`.
- **Rotas legadas são shims de redirect:** `/onboarding` → `/onboarding-v2`,
  `/dashboard` e `/evolucao` → `/progresso`. `/` redireciona para `/hoje`.
  Navegação em `Sidebar.tsx` (desktop) e `Nav.tsx` (mobile) — mantém os dois
  em sincronia.

### Fluxo principal (onboarding → programa)

`/onboarding-v2` (draft em localStorage) → `submitAssessment` →
`/analise-inicial` (calcula scores por área) → `generateProgramFromAssessment`
→ grava `programs → program_weeks → program_days → program_tasks` → `/programa`.
O dia a dia acontece em `/hoje` e `/checkin` (manhã/tarde/noite).

### PWA e push

- `next-pwa` gera `public/sw.js` no build (ignorado no Git; desativado em dev).
- O registo do SW é manual (`src/lib/push.ts` → `/push-worker.js`), um SW
  mínimo dedicado a Web Push — o SW pesado do next-pwa não instalava no iOS.
  O handler de push/notification-click está em `worker/index.js`.
- Edge Functions Supabase em `supabase/functions/`: `send-reminders`
  (notificações agendadas) e `delete-account`.

## Base de dados

- Scripts SQL em `supabase/` (aplicados manualmente no SQL Editor, não são
  migrations formais). **Atenção:** o código usa ~28 tabelas + RPCs, mas os
  `.sql` versionados cobrem só parte — não assumas que `supabase/*.sql`
  reflete o schema completo em produção (ver `docs/TECHNICAL_DEBT.md`).
- Isolamento por utilizador via RLS `auth.uid() = user_id`; `profiles.id`
  = `auth.uid()` é dono de tudo.
- Alterações de schema: cria um novo ficheiro `supabase/<feature>_v<N>.sql`
  idempotente, seguindo o padrão dos existentes.

## Estilo e UI

- **Estilos inline + tokens CSS** em `src/app/globals.css` são o padrão
  dominante; Tailwind 3 está configurado mas é subutilizado. Segue o estilo do
  ficheiro que estás a editar.
- Tokens de tema (dark por defeito, com suporte a light via
  `:root[data-theme]`): `--bg0..3`, `--gold`, `--teal`, `--accent`, `--text1..3`,
  `--ink`/`--ink-rgb`, `--surface-*`. Usa os tokens em vez de cores hardcoded.
- Gráficos com **Recharts**; datas com **date-fns**.

## Testes

- Vitest + jsdom, globals ativados, alias `@` → `src` (ver `vitest.config.ts`).
- A suite cobre os engines puros de `src/lib/__tests__/` (+
  `src/app/financas/__tests__/`). Não há testes de UI/integração apesar de
  Testing Library estar instalada.

## Documentação de referência

- `docs/ARCHITECTURE.md` — rotas, componentes, modelo de dados, fluxos.
- `docs/PROJECT_OVERVIEW.md` — visão de produto.
- `docs/TECHNICAL_DEBT.md` — riscos conhecidos (schema incompleto, RLS não
  auditável, monolito `supabase.ts`, sem CI).
- `docs/handoff/` e `docs/superpowers/` — histórico de sessões/planos (pode
  estar desatualizado; o código é a fonte de verdade).
