# Handoff — Corpo Page Rebuild
**Date:** 2026-04-12  
**Branch:** `main` (up to date with origin)  
**Last commit:** `dff9a09`

---

## O que foi feito nesta sessão

### Bug fixes (pré-rebuild)
| Bug | Causa | Fix |
|-----|-------|-----|
| Vercel build error | `supabase.ts` importava `emitToast` de `@/components/Toast` (`'use client'`) | Criado `src/lib/toast-events.ts` sem `'use client'`; `Toast.tsx` limpo de re-exports |
| PlanReviewModal sem scroll | Flexbox `min-height: auto` impedia `overflow: auto` | `flex: '1 1 0'` + `minHeight: 0` no body div; `overflow: hidden` no container |
| Agenda tab sempre 0 eventos | `getAgendaEvents` usava `${year}-${month}-31` → data inválida no PostgreSQL | Substituído por `format(endOfMonth(firstDay), 'yyyy-MM-dd')` |
| Event form scroll (Calendário) | Faltava `minHeight: 0` no div scrollável | Adicionado |

### Corpo page — rebuild completo
A página `/corpo` (~1300 LOC monolito) foi reescrita do zero como arquitetura de componentes.

---

## Arquitetura atual

```
src/app/corpo/page.tsx                   ← orchestrator (~111 linhas)
src/components/corpo/
  WorkoutTracker.tsx   (883 linhas)      ← tab Treino
  DietTracker.tsx      (497 linhas)      ← tab Dieta
  WeightLog.tsx        (321 linhas)      ← tab Peso
  PlanSelector.tsx     (364 linhas)      ← bottom sheet para selecionar treino do dia
src/lib/body.ts        (161 linhas)      ← CRUD: training entries, diet meals, planos, peso
src/lib/toast-events.ts                  ← emitToast sem 'use client'
```

---

## Funcionalidades implementadas

### Tab Treino (WorkoutTracker)
- **PlanSelector**: bottom sheet que lista planos importados agrupados por secções; selecção persiste em `sessionStorage` com chave `nexus-corpo-YYYY-MM-DD`
- **Load memory**: ao abrir exercício, pré-popula os pesos do último registo do mesmo plano
- **Séries**: cada exercício expande com rows de `kg × reps`; botões `+`/`−` para adicionar/remover séries
- **Auto-save**: debounce 800ms → `upsertTrainingEntry`
- **Formato de dados** (NotesV2):
  ```typescript
  type ExerciseLoad = { weight: string; reps: string }
  type ExerciseSave = { done: boolean; sets: ExerciseLoad[] }
  type NotesV2 = { v: 2; sectionIdx: number; exercises: Record<string, ExerciseSave> }
  ```
- **Migração v1→v2**: `parseNotes()` converte formato antigo `{ exercises: { checked, load } }` automaticamente
- **Import flow**: FileImportModal → parser → PlanReviewModal → ao confirmar, PlanSelector abre automaticamente com novo plano
- **Histórico de planos** com botão `×` para apagar via `deleteTrainingPlan`

### Tab Dieta (DietTracker)
- 4 refeições: `pequeno_almoco`, `almoco`, `lanche`, `jantar`
- Checkboxes por item + notas por refeição (debounce 1000ms)
- Import de dieta com FileImportModal + PlanReviewModal (mode="diet")
- Histórico de planos com delete via `deleteDietPlan`

### Tab Peso (WeightLog)
- Input: data + kg + botão "Registar"
- Recharts LineChart com filtros: 30d / 90d / Tudo
- Cards: Último peso + Variação (teal/gold)
- Histórico newest-first com delete
- Valida 0 < kg ≤ 500

---

## ⚠️ Migração SQL pendente

**A tab Peso não funcionará até esta migration ser executada no Supabase dashboard:**

```sql
CREATE TABLE IF NOT EXISTS body_measurements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  weight_kg   NUMERIC(5,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON body_measurements
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Commits desta sessão (ordem cronológica)

```
a56621d  fix: robust modal scroll + clean up Toast re-exports
7324849  fix: agenda date range, modal scroll, inline add item
74e5610  feat: body.ts — weight CRUD, plan deletion, prev entry lookup, error toasts
def54c6  feat: PlanSelector — bottom sheet for daily workout section selection
1d9f6e6  fix: PlanSelector z-index convention and maxWidth centering
011c5e7  feat: WorkoutTracker — exercise tracking with sets, load memory, import flow
cf2bfcb  feat: DietTracker — diet tab with meal tracking, notes, and import
751891c  feat: WeightLog — weight tracking with Recharts chart and history
1598362  feat: corpo page — 3-tab orchestrator (Treino/Dieta/Peso)
dff9a09  chore: update Claude Code launch config and local permissions
```

---

## Padrões e convenções do projecto

| Convenção | Valor |
|-----------|-------|
| z-index modais de fundo | 9200–9299 |
| z-index overlays principais | 9300–9399 |
| z-index bottom sheets | 9400–9499 |
| z-index PlanReviewModal | 9500 |
| z-index toasts | 9999 |
| maxWidth bottom sheets | 480px, `margin: '0 auto'` |
| Scroll em flex container | `flex: '1 1 0'` + `minHeight: 0` + `overflowY: 'auto'` no filho |
| Toasts | `useToast()` em componentes; `emitToast()` em lib (sem React) |
| `'use client'` | Apenas em componentes — nunca em `src/lib/` |
| Datas | `getLocalDate()` no orchestrator para evitar desfasamento UTC |

---

## Ficheiros-chave para próxima sessão

| Ficheiro | Para quê |
|----------|----------|
| `src/app/corpo/page.tsx` | Orchestrator, auth bootstrap, tab routing |
| `src/components/corpo/WorkoutTracker.tsx` | Lógica principal de treino |
| `src/components/corpo/PlanSelector.tsx` | Bottom sheet seleção de plano |
| `src/lib/body.ts` | Todo o CRUD de corpo (training, diet, peso) |
| `src/lib/supabase.ts` | CRUD geral (planos, agenda, etc.) |
| `src/lib/toast-events.ts` | `emitToast` — não tem `'use client'` |
| `docs/superpowers/specs/2026-04-09-corpo-rebuild-design.md` | Design spec completo do rebuild |

---

## Possíveis próximas tarefas

- [ ] Executar migration SQL do `body_measurements` no Supabase
- [ ] Testar WorkoutTracker em dispositivo real (load memory, auto-save)
- [ ] Testar import de plano de treino end-to-end
- [ ] Rever outras páginas que possam ter o mesmo bug de scroll (flexbox)
- [ ] Verificar TypeScript em CI (`npm run build`)
