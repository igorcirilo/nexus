# NEXUS — APIs e Integrações

> Legenda: **[C]** confirmado · **[I]** inferência · **[?]** não confirmado.
> Nenhum valor sensível é exposto neste documento.

## Resumo

O único serviço externo é o **Supabase** (backend completo). **Não há** `fetch`/
`axios`/SDKs de terceiros, storage/upload remoto, pagamentos, mapas, e-mail,
analytics ou IA. O parsing de PDF/planilha é **client-side e sem bibliotecas
externas**. **[C]**

## Supabase

- **Cliente principal:** `src/lib/supabase.ts` (`createClient`), reúne a maioria
  das queries da app (~1090 linhas).
- **Clientes inline adicionais:** `src/app/analise-inicial/page.tsx`,
  `src/app/onboarding-v2/page.tsx`, `src/app/programa/page.tsx` criam o próprio
  `createClient`. *Recomendação: consolidar no cliente único para evitar o aviso
  "Multiple GoTrueClient instances".* **[C]**

### Auth (email + password) — sem magic link
`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `signOut`,
`getSession`, `getUser`. Notas operacionais em `SUPABASE_AUTH_CONFIG.md` (ex.:
desativar "Confirm email" no Supabase se não for desejado). **[C]**

### Tabelas usadas pelo código (`.from(...)`)
`profiles`, `habits`, `habit_logs`, `checkins`, `transactions`,
`focus_sessions`, `user_badges`, `weekly_league_snapshots`, `user_assessments`,
`life_area_scores`, `programs`, `program_weeks`, `program_days`,
`program_tasks`, `task_templates`, `training_plans`, `training_entries`,
`diet_plans`, `diet_meals`, `body_measurements`, `agenda_events`,
`goal_milestones`, `reminders`, `books`, `book_progress`, `book_highlights`,
`book_notes`, `book_bookmarks`, `reading_preferences`. **[C]**

### Funções RPC
- `add_xp` — atribuição de XP. **[C]**
- `update_streak` — atualização de streak diário. **[C]**

> ⚠️ Nem todas estas tabelas/RPCs estão versionadas em `supabase/*.sql`. Ver
> `TECHNICAL_DEBT.md` (risco crítico de schema incompleto e RLS não auditável).

### Row Level Security
Modelo esperado: isolamento por `auth.uid() = user_id` em cada tabela. As
políticas das tabelas centrais **não estão totalmente versionadas** no repo, o
que impede auditoria de segurança a partir do código. **[C/?]**

## Bibliotecas de runtime relevantes

| Lib | Uso | Evidência |
|---|---|---|
| `@supabase/supabase-js`, `@supabase/ssr` | DB/Auth | imports em `lib` e páginas **[C]** |
| `recharts` | Gráficos (peso, progresso) | `WeightLog.tsx` **[C]** |
| `date-fns` | Datas | usado em `lib`/páginas **[C]** |
| `next-pwa` | Service worker / PWA | `next.config.mjs` **[C]** |
| `clsx` | Composição de classes | **[C]** |

## Import de ficheiros (sem rede)

- `src/lib/pdf.ts` — extrai candidatos financeiros de PDF.
- `src/lib/spreadsheet.ts` — leitura de planilhas.
- `src/lib/csv-parser.ts` — parsing de CSV.
- Saída tipada: `FinancialImportCandidate` / `FinancialImportPreview` /
  `FileImportResult` (`src/types/index.ts`). Confirmação do utilizador via
  `ImportPreview.tsx` antes de gravar `transactions`. **[C]**

## Variáveis de ambiente

| Variável | Obrigatória | Finalidade | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase | inlined em build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | chave anon/publishable | pública por design; segurança via RLS |

> A chave anon/publishable é exposta ao browser por natureza. A segurança real
> depende das RLS policies. Recomenda-se rotacionar a chave que esteve no
> `.env.local.example` e auditar as policies.
