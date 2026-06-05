# NEXUS — Arquitetura

> Legenda: **[C]** confirmado · **[I]** inferência · **[?]** não confirmado.

## Visão geral

Aplicação **client-heavy**: quase todas as páginas são `'use client'` e fazem
fetch direto ao **Supabase** no browser. **Não há backend próprio nem API
routes** — o Supabase é o backend (Postgres + Auth + RLS + RPC). A regra de
negócio "dura" (scoring, geração de programa, parsing) vive em `src/lib/*` como
**funções puras testáveis**; a UI orquestra estado local (`useState`/`useEffect`)
e chama essas funções + o cliente Supabase. **[C]**

```
Usuário
  ↓
Telas (src/app/**/page.tsx, 'use client')
  ↓
Componentes (src/components/**)
  ↓
Engines puros (src/lib/*-engine.ts, mentor, parsers)  +  Acesso a dados (src/lib/supabase.ts, body.ts, program.ts)
  ↓
Supabase (Postgres + Auth + RLS + RPC)   |   localStorage (draft onboarding, cargas de treino)
```

## Camadas

### Frontend
- **Rotas:** App Router (`src/app`), 21 páginas + `layout.tsx` + `globals.css`.
- **Componentes:** 26 em `src/components` (+ `corpo/`, `onboarding/`).
- **Estado:** sem Redux/Zustand/React Query. Apenas **Context para Toasts**
  (`Toast.tsx`) + canal de eventos `window` (`lib/toast-events.ts`). Cada página
  busca dados no `useEffect`; sem cache de servidor. **[C]**
- **Estilo:** estilos inline + tokens CSS (`globals.css`); Tailwind 3 configurado
  mas subutilizado no código observado. **[C/I]**
- **PWA:** `next-pwa` (workbox) gera `public/sw.js` no build (ignorado no Git).

### Backend (Supabase)
- **Auth:** email + password (`signUp`, `signInWithPassword`,
  `resetPasswordForEmail`, `signOut`, `getSession`, `getUser`). Sem magic link. **[C]**
- **DB:** Postgres acedido via `supabase-js`; sem ORM.
- **RPC:** `add_xp`, `update_streak`. **[C]**
- **RLS:** isolamento por `auth.uid() = user_id` (políticas parcialmente
  versionadas — ver TECHNICAL_DEBT). **[C/?]**

### Infra
- **Build:** `next build` (22 páginas). **Deploy:** Vercel **[I]**.
- **CI/CD:** inexistente. **Docker:** inexistente. **[C]**

## Rotas, páginas e telas

| Rota | Arquivo | Função | Observações |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirect → `/hoje` | server redirect |
| `/auth` | `app/auth/page.tsx` | Login/registo/recuperação | email+password |
| `/onboarding-v2` | `app/onboarding-v2/page.tsx` | Onboarding (assessment) | draft em localStorage |
| `/onboarding` | `app/onboarding/page.tsx` | **Redirect legado** → v2 | shim |
| `/analise-inicial` | `app/analise-inicial/page.tsx` | Score + CTA gerar programa | |
| `/programa` | `app/programa/page.tsx` | Vista semanal do programa 63d | |
| `/hoje` | `app/hoje/page.tsx` | Hub diário | |
| `/habitos` | `app/habitos/page.tsx` | Hábitos | |
| `/checkin` | `app/checkin/page.tsx` | Check-in manhã/tarde/noite | |
| `/corpo` | `app/corpo/page.tsx` | Treino/Dieta/Peso (3 tabs) | |
| `/financas` | `app/financas/page.tsx` | Finanças + import PDF/planilha | |
| `/leitura` · `/leitura/[id]` | `app/leitura/...` | Biblioteca · e-reader | rota dinâmica |
| `/objetivos` | `app/objetivos/page.tsx` | Objetivos 90d + milestones | |
| `/calendario` | `app/calendario/page.tsx` | Agenda/eventos | |
| `/lembretes` | `app/lembretes/page.tsx` | Lembretes | |
| `/progresso` | `app/progresso/page.tsx` | Estatísticas (canónica) | |
| `/dashboard`, `/evolucao` | `app/.../page.tsx` | **Redirects legados** → `/progresso` | shims |
| `/perfil` | `app/perfil/page.tsx` | Perfil/conta | |

Navegação: `Sidebar.tsx` (desktop) e `Nav.tsx` (mobile), 9 itens idênticos.

## Componentes principais

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `Sidebar` / `Nav` | `components/` | Navegação desktop/mobile |
| `ToastProvider`/`Toast` | `Toast.tsx` | Toasts via Context + eventos `window` |
| `GlobalUI` | `GlobalUI.tsx` | QuickAction + Pomodoro globais (client-only) |
| `WorkoutTracker`/`DietTracker`/`WeightLog`/`PlanSelector` | `components/corpo/` | Núcleo da feature Corpo (os maiores ficheiros, ~880 linhas) |
| `FileImportModal`/`ImportPreview`/`PlanReviewModal` | `components/` | Import de ficheiros (finanças/planos) |
| `Question*`+`QuestionRenderer`+`ProgressBar` | `components/onboarding/` | Render dinâmico do onboarding |
| `XPBar`,`XPToast`,`AvatarXP`,`LevelUpModal`,`BadgeModal`,`WeeklyLeagueCard`,`WeeklyRankCard`,`StreakRecovery`,`MissionCard`,`MentorCard`,`NightSummaryCard`,`HabitItem`,`EmptyState`,`QuickAction` | `components/` | Gamificação e blocos de UI de domínio |

## Modelo de dados (entidades)

Tipos completos em `src/types/index.ts`. Tabelas por domínio:

- **Perfil/Gamificação:** `profiles`, `user_badges`, `weekly_league_snapshots`.
- **Hábitos/Check-ins:** `habits`, `habit_logs`, `checkins`.
- **Programa:** `user_assessments`, `life_area_scores`, `programs`,
  `program_weeks`, `program_days`, `program_tasks`, `task_templates`.
- **Corpo:** `training_plans`, `training_entries`, `diet_plans`, `diet_meals`,
  `body_measurements`.
- **Finanças:** `transactions`. **Foco:** `focus_sessions`.
- **Objetivos/Agenda:** `goal_milestones`, `agenda_events`, `reminders`.
- **Leitura:** `books`, `book_progress`, `book_highlights`, `book_notes`,
  `book_bookmarks`, `reading_preferences`.

**Relações [C/I]:** `profiles.id = auth.uid()` é dono de tudo (FK `user_id` +
RLS). `programs → program_weeks → program_days → program_tasks`;
`program_tasks.template_id → task_templates`; `books → book_*`.

> ⚠️ O código usa **28 tabelas + RPCs `add_xp`/`update_streak`**, mas
> `supabase/*.sql` versiona só ~13. Ver TECHNICAL_DEBT (risco crítico).

## Fluxos principais

- **Auth:** `/auth` → Supabase Auth → sessão → app.
- **Onboarding → Programa:** `/onboarding-v2` (draft em localStorage) →
  `submitAssessment` → `/analise-inicial` (`calculateScores`/`saveScores`) →
  `generateProgramFromAssessment` → grava `programs/weeks/days/tasks` → `/programa`.
- **Dia a dia:** `/hoje` conclui tarefas/hábitos → RPC `add_xp`/`update_streak` →
  toasts/XP/level-up; `/checkin` regista as 3 fases.
- **Corpo:** `/corpo` (Treino/Dieta/Peso); cargas em localStorage; peso → Recharts.
- **Import financeiro:** `FileImportModal` → `pdf.ts`/`spreadsheet.ts` →
  `FinancialImportCandidate[]` → `ImportPreview` → grava `transactions`.
- **Leitura:** `/leitura` → `/leitura/[id]` (páginas, destaques, notas, marcadores).

## Lógica de negócio

Engines puros e testados em `src/lib`: `onboarding-engine.ts`,
`program-engine.ts`, `profile-assessment.ts`, `assessment-to-program.ts`,
`mentor.ts`, `pdf.ts`, `spreadsheet.ts`, `csv-parser.ts`, `body-plan.ts`. O
acesso a dados está centralizado em `lib/supabase.ts` (~1090 linhas — candidato
a modularização).
