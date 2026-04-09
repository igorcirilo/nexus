# Corpo Page Rebuild — Design Spec
**Date:** 2026-04-09  
**Status:** Approved

---

## Problem Statement

The current `/corpo` page (~1300 LOC monolith) has three critical failures:
1. **Import broken** — parser produces poor results; no scroll in review modal (fixed separately); UX confusing
2. **No body measurement tracking** — page called "Corpo" but has no weight/measurement log
3. **Daily tracking unusable at the gym** — no structured load entry (weight × reps × sets); state management brittle

User workflow: opens app at gym → selects today's workout → marks exercises with loads → checks progress over time.

---

## Architecture

### File Structure

```
src/app/corpo/page.tsx                   ← orchestrator only (~150 lines)
src/components/corpo/
  WorkoutTracker.tsx                     ← Treino tab
  DietTracker.tsx                        ← Dieta tab (simplified from current)
  WeightLog.tsx                          ← Peso tab (new)
  PlanSelector.tsx                       ← modal: pick plan section for today
src/lib/body.ts                          ← add deleteTrainingPlan, deleteDietPlan, weight CRUD
```

### Navigation

Three tabs at top of page: **Treino · Dieta · Peso**

Tab state persisted in `sessionStorage` (survives soft nav, resets on close).

---

## Tab: Treino (WorkoutTracker)

### Layout

```
[Header: Plan name + "Trocar" button]
[Progress bar: 5/8 exercícios ✓]
─────────────────────────────────────
[Exercise list — scrollable]
─────────────────────────────────────
[Import plan button — subtle, bottom]
```

### PlanSelector Modal

Triggered on first open (no plan chosen today) or "Trocar" button.

- Lists all imported training plans grouped by plan title
- Each plan shows its sections (e.g. "Treino A — Peito/Trícep", "Treino B — Costas/Bícep")
- Tap a section → sets it as today's workout, closes modal
- Bottom sheet style (slides up from bottom)

### Exercise Row — Collapsed State

```
☐  Supino Reto                      ▼
   (tap to expand)
```

After saving:
```
✓  Supino Reto                      ▼
   3s · 80kg × 10
```

### Exercise Row — Expanded State

```
✓  Supino Reto                      ▲
   Série 1:  [80] kg  ×  [10] reps
   Série 2:  [80] kg  ×  [8 ] reps
   Série 3:  [75] kg  ×  [8 ] reps   + −
                         [Guardar ✓]
```

**Behaviour:**
- Tap row → expand, pre-populate from **previous day's entry** for same plan+exercise (load memory)
- `+` adds set row, `−` removes last set (min 1)
- "Guardar" saves and collapses row
- Tap checkbox without expanding → mark done with no load (for bodyweight/cardio)
- Auto-save on collapse (onBlur of last field)

### Data Format

Stored in `training_entries.notes` (existing JSON column):

```typescript
type ExerciseLoad = { weight: number | null; reps: number | null }
type ExerciseSave = { done: boolean; sets: ExerciseLoad[] }
type TrainingNotesV2 = { v: 2; exercises: Record<string, ExerciseSave> }
```

Version field `v: 2` allows backward-compatible migration from old format on read.

---

## Tab: Dieta (DietTracker)

Functionally identical to current implementation, but extracted as standalone component.

- 4 meal sections (Pequeno-almoço, Almoço, Lanche, Jantar)
- Item-level checkboxes
- Free-text notes per meal
- `upsertDietMeal` called directly (no intermediate local state sync issues)
- `+ Importar dieta` button at top

---

## Tab: Peso (WeightLog) — New

### Layout

```
[Input row: date field + kg field + "Registar" button]
─────────────────────────────────────────────────────
[Recharts LineChart — weight over time]
[Filter: 30d | 90d | Tudo]
─────────────────────────────────────────────────────
[History list]
  09/04  75.4 kg                              ×
  07/04  76.1 kg                              ×
```

### Database

New table (SQL migration required):
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
CREATE POLICY "own data" ON body_measurements
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

One entry per user per day (`ON CONFLICT (user_id, date) DO UPDATE`).

### Supabase Functions (new in `body.ts`)

```typescript
getWeightLogs(userId, days?)      → [{ date, weight_kg }] ordered ASC
upsertWeightLog(userId, date, weight_kg) → upsert with conflict on (user_id, date)
deleteWeightLog(userId, id)       → delete by id
```

---

## Import Flow (Improved UX)

1. "Importar plano" button in WorkoutTracker opens a bottom sheet
2. File picker → parser → PlanReviewModal (already fixed with scroll)
3. On confirm → save plan → **PlanSelector opens automatically** with new plan pre-highlighted
4. History section in bottom sheet: lists existing plans with `×` delete button

New Supabase functions:
```typescript
deleteTrainingPlan(id, userId)    → DELETE from training_plans
deleteDietPlan(id, userId)        → DELETE from diet_plans
```

---

## Data Migration

On first load of `WorkoutTracker`, existing `training_entries.notes` records are read with backward-compat:
- If `notes.v === 2` → use as-is
- If `notes` has old format (`{ freeText, exercises: { checked, load, notes } }`) → convert on read, save v2 on next write
- If `notes` is null/unknown → treat as empty

---

## What Does NOT Change

- `src/lib/body-plan.ts` — parser kept as-is
- `src/components/PlanReviewModal.tsx` — already fixed
- `training_plans`, `diet_plans`, `training_entries`, `diet_meals` table schemas
- Toast system, Nav, global layout

---

## SQL Migrations Required

Run in Supabase dashboard before or during deployment:

```sql
-- 1. Body measurements table
CREATE TABLE IF NOT EXISTS body_measurements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  weight_kg   NUMERIC(5,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON body_measurements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. streak_freeze_used_week (if not already run)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_freeze_used_week TEXT;
```

---

## Success Criteria

- [ ] Open Corpo → immediately see today's workout (or quick picker if none chosen)
- [ ] Tap exercise → expand, see previous load pre-populated, enter new load, save
- [ ] Progress bar updates as exercises are marked
- [ ] Weight tab: log weight, see chart, delete entries
- [ ] Diet tab: works as before, no regressions
- [ ] Import a plan → review modal scrolls → confirm → plan selector opens automatically
- [ ] Delete a plan from history
- [ ] No TypeScript errors
- [ ] No silent failures (all errors shown as toasts)
