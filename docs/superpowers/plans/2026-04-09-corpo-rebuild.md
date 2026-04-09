# Corpo Page Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/corpo` page with functional exercise tracking (sets × weight × reps), weight logging with chart, and clean component architecture.

**Architecture:** The 1300-line monolith is split into 4 focused components (`WorkoutTracker`, `DietTracker`, `WeightLog`, `PlanSelector`) plus a thin orchestrator page. Exercise loads are stored in `training_entries.notes` as versioned JSON `{ v: 2, sectionIdx, exercises: {...} }`. Weight tracking uses a new `body_measurements` Supabase table.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Recharts (already installed), date-fns v3, Tailwind-like CSS vars

---

## Task 1: SQL Migration + body.ts additions

**Files:**
- Modify: `src/lib/body.ts`
- Reference SQL (run manually in Supabase): see step below

- [ ] **Step 1: Run SQL in Supabase dashboard**

Go to Supabase → SQL Editor → run:

```sql
-- Body measurements table
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

-- Streak freeze column (if not already done)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_freeze_used_week TEXT;
```

- [ ] **Step 2: Replace `src/lib/body.ts` entirely**

```typescript
// src/lib/body.ts
import { supabase } from '@/lib/supabase'
import { emitToast } from '@/lib/toast-events'
import { format, subDays } from 'date-fns'

function reportErr(ctx: string, msg: string) {
  console.error(`${ctx}:`, msg)
  emitToast(`Erro: ${ctx}`, 'error')
}

// ── Training Entries ────────────────────────────────────────

export async function getTrainingEntries(userId: string, date: string) {
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false })
  if (error) { reportErr('getTrainingEntries', error.message); return [] }
  return data ?? []
}

export async function getPrevTrainingEntry(userId: string, planId: string, date: string) {
  // Find most recent entry for same plan before given date
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { reportErr('getPrevTrainingEntry', error.message); return null }
  return data ?? null
}

export async function upsertTrainingEntry(payload: {
  user_id: string
  training_plan_id: string
  date: string
  completed: boolean
  notes?: string | null
}) {
  const record = {
    ...payload,
    notes: payload.notes ?? null,
    completed_at: payload.completed ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase
    .from('training_entries')
    .upsert(record, { onConflict: 'user_id,training_plan_id,date' })
    .select()
    .single()
  if (error) reportErr('upsertTrainingEntry', error.message)
  return { data, error }
}

// ── Diet Meals ──────────────────────────────────────────────

export async function getDietMeals(userId: string, date: string) {
  const { data, error } = await supabase
    .from('diet_meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) { reportErr('getDietMeals', error.message); return [] }
  return data ?? []
}

export async function upsertDietMeal(payload: {
  user_id: string
  diet_plan_id: string
  date: string
  meal_key: 'pequeno_almoco' | 'almoco' | 'jantar' | 'lanche'
  completed: boolean
  notes?: string | null
}) {
  const record = {
    ...payload,
    notes: payload.notes ?? null,
    completed_at: payload.completed ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase
    .from('diet_meals')
    .upsert(record, { onConflict: 'user_id,diet_plan_id,date,meal_key' })
    .select()
    .single()
  if (error) reportErr('upsertDietMeal', error.message)
  return { data, error }
}

// ── Plan Deletion ───────────────────────────────────────────

export async function deleteTrainingPlan(id: string, userId: string) {
  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteTrainingPlan', error.message)
  return { error }
}

export async function deleteDietPlan(id: string, userId: string) {
  const { error } = await supabase
    .from('diet_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteDietPlan', error.message)
  return { error }
}

// ── Weight Logs ─────────────────────────────────────────────

export type WeightLog = {
  id: string
  user_id: string
  date: string
  weight_kg: number
  created_at: string
}

export async function getWeightLogs(userId: string, days?: number): Promise<WeightLog[]> {
  let query = supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (days) {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
    query = query.gte('date', since)
  }

  const { data, error } = await query
  if (error) { reportErr('getWeightLogs', error.message); return [] }
  return (data ?? []) as WeightLog[]
}

export async function upsertWeightLog(userId: string, date: string, weightKg: number) {
  const { data, error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) reportErr('upsertWeightLog', error.message)
  return { data: data as WeightLog | null, error }
}

export async function deleteWeightLog(userId: string, id: string) {
  const { error } = await supabase
    .from('body_measurements')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteWeightLog', error.message)
  return { error }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/body.ts
git commit -m "feat: body.ts — weight CRUD, plan deletion, prev entry lookup, error toasts"
```

---

## Task 2: PlanSelector Component

**Files:**
- Create: `src/components/corpo/PlanSelector.tsx`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/components/corpo
```

Create `src/components/corpo/PlanSelector.tsx`:

```typescript
// src/components/corpo/PlanSelector.tsx
'use client'
import { useState } from 'react'
import type { TrainingPlan } from '@/types'
import type { ParsedTrainingPlan } from '@/lib/body-plan'

interface Props {
  plans: TrainingPlan[]
  onSelect: (planId: string, sectionIdx: number, sectionTitle: string) => void
  onClose: () => void
  onImport: () => void
}

function getParsed(plan: TrainingPlan): ParsedTrainingPlan | null {
  const raw = plan.raw_content as { parsedPlan?: ParsedTrainingPlan } | null
  return raw?.parsedPlan ?? null
}

export default function PlanSelector({ plans, onSelect, onClose, onImport }: Props) {
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(
    plans.length === 1 ? plans[0].id : null
  )

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      background: 'rgba(0,0,0,.7)', zIndex: 9400,
      display: 'flex', alignItems: 'flex-end',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'var(--bg1)', borderRadius: '20px 20px 0 0',
        borderTop: '0.5px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '80vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '0.5px solid var(--border)',
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
              Que treino fazes hoje?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Escolhe o plano e a sessão
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 9, background: 'var(--bg3)',
            border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)',
          }}>×</button>
        </div>

        {/* Plan list */}
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
          {plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              Nenhum plano importado ainda.
              <br />
              <button onClick={onImport} style={{
                marginTop: 12, background: 'var(--gold)', color: 'var(--bg0)',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                Importar plano
              </button>
            </div>
          ) : (
            plans.map(plan => {
              const parsed = getParsed(plan)
              const isOpen = expandedPlanId === plan.id
              return (
                <div key={plan.id} style={{
                  background: 'var(--bg2)', borderRadius: 14,
                  border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden',
                }}>
                  {/* Plan header */}
                  <button onClick={() => setExpandedPlanId(isOpen ? null : plan.id)} style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '13px 14px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', textAlign: 'left',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>
                        {plan.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {parsed ? `${parsed.sections.length} sessões` : 'Sem secções'}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                  </button>

                  {/* Sections */}
                  {isOpen && parsed && (
                    <div style={{ borderTop: '0.5px solid var(--border)' }}>
                      {parsed.sections.map((section, idx) => (
                        <button key={section.id} onClick={() => onSelect(plan.id, idx, section.title)} style={{
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          padding: '11px 14px', display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', borderBottom: idx < parsed.sections.length - 1 ? '0.5px solid var(--border)' : 'none',
                          textAlign: 'left',
                        }}>
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>{section.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                              {section.exercises.length} exercícios
                            </div>
                          </div>
                          <span style={{ color: 'var(--gold)', fontSize: 16 }}>→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Import button at bottom */}
          {plans.length > 0 && (
            <button onClick={onImport} style={{
              width: '100%', background: 'none', border: '0.5px dashed var(--border)',
              borderRadius: 12, padding: '11px 14px', color: 'var(--text3)',
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer', marginTop: 4,
            }}>
              + Importar novo plano
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/corpo/PlanSelector.tsx
git commit -m "feat: PlanSelector — bottom sheet modal for daily workout section selection"
```

---

## Task 3: WorkoutTracker Component

**Files:**
- Create: `src/components/corpo/WorkoutTracker.tsx`

This is the core component. It handles: selecting today's section, displaying exercises, capturing loads per set, saving to Supabase, and managing import flow.

- [ ] **Step 1: Create `src/components/corpo/WorkoutTracker.tsx`**

```typescript
// src/components/corpo/WorkoutTracker.tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import PlanSelector from '@/components/corpo/PlanSelector'
import { useToast } from '@/components/Toast'
import { getTrainingPlans, saveTrainingPlan } from '@/lib/supabase'
import {
  getTrainingEntries, getPrevTrainingEntry,
  upsertTrainingEntry, deleteTrainingPlan,
} from '@/lib/body'
import { parseTrainingImport, type ParsedTrainingPlan, type FileImportResult } from '@/lib/body-plan'
import type { TrainingPlan, TrainingEntry } from '@/types'

// ── Types ──────────────────────────────────────────────────
type ExerciseLoad = { weight: string; reps: string }
type ExerciseSave = { done: boolean; sets: ExerciseLoad[] }
type NotesV2 = { v: 2; sectionIdx: number; exercises: Record<string, ExerciseSave> }

function emptyLoad(): ExerciseLoad { return { weight: '', reps: '' } }
function defaultSave(): ExerciseSave { return { done: false, sets: [emptyLoad()] } }

function parseNotes(raw: string | null | undefined): NotesV2 {
  if (!raw) return { v: 2, sectionIdx: 0, exercises: {} }
  try {
    const p = JSON.parse(raw)
    // v2 format
    if (p?.v === 2) return p as NotesV2
    // legacy format migration: { freeText, exercises: { [id]: { checked, load, notes } } }
    if (p?.exercises && typeof p.exercises === 'object') {
      const migrated: Record<string, ExerciseSave> = {}
      for (const [id, val] of Object.entries(p.exercises as Record<string, { checked?: boolean; load?: string }>)) {
        migrated[id] = { done: val.checked ?? false, sets: [{ weight: val.load ?? '', reps: '' }] }
      }
      return { v: 2, sectionIdx: 0, exercises: migrated }
    }
  } catch { /* ignore */ }
  return { v: 2, sectionIdx: 0, exercises: {} }
}

function getParsed(plan: TrainingPlan | null): ParsedTrainingPlan | null {
  if (!plan?.raw_content) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedTrainingPlan }
  return raw.parsedPlan ?? null
}

function sessionKey(today: string) { return `nexus-corpo-${today}` }

// ── Props ──────────────────────────────────────────────────
interface Props {
  userId: string
  today: string
  initialPlans: TrainingPlan[]
}

// ── Component ──────────────────────────────────────────────
export default function WorkoutTracker({ userId, today, initialPlans }: Props) {
  const toast = useToast()

  const [plans, setPlans]             = useState<TrainingPlan[]>(initialPlans)
  const [planId, setPlanId]           = useState<string | null>(null)
  const [sectionIdx, setSectionIdx]   = useState(0)
  const [sectionTitle, setSectionTitle] = useState('')
  const [entry, setEntry]             = useState<TrainingEntry | null>(null)
  const [saves, setSaves]             = useState<Record<string, ExerciseSave>>({})
  const [prevSaves, setPrevSaves]     = useState<Record<string, ExerciseSave>>({})
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [importReview, setImportReview] = useState<{ result: FileImportResult; parsed: ParsedTrainingPlan } | null>(null)
  const [saving, setSaving]           = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Restore session selection ───────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey(today))
    if (stored) {
      try {
        const { planId: pid, sectionIdx: si, sectionTitle: st } = JSON.parse(stored)
        setPlanId(pid); setSectionIdx(si); setSectionTitle(st)
      } catch { /* ignore */ }
    } else if (initialPlans.length > 0) {
      setShowSelector(true)
    }
  }, [today, initialPlans.length])

  // ── Load today's entry + previous entry ─────────────────
  useEffect(() => {
    if (!planId) return
    let active = true

    async function load() {
      const entries = await getTrainingEntries(userId, today) as TrainingEntry[]
      const todayEntry = entries.find(e => e.training_plan_id === planId) ?? null
      if (!active) return
      setEntry(todayEntry)
      const parsed = parseNotes(todayEntry?.notes)
      setSaves(parsed.exercises)

      // Load previous day's entry for load memory
      const prev = await getPrevTrainingEntry(userId, planId, today) as TrainingEntry | null
      if (!active) return
      const prevParsed = parseNotes(prev?.notes)
      setPrevSaves(prevParsed.exercises)
    }

    load()
    return () => { active = false }
  }, [userId, today, planId])

  // ── Persist selection to session ─────────────────────────
  function selectSection(pid: string, si: number, st: string) {
    setPlanId(pid); setSectionIdx(si); setSectionTitle(st)
    setShowSelector(false)
    sessionStorage.setItem(sessionKey(today), JSON.stringify({ planId: pid, sectionIdx: si, sectionTitle: st }))
  }

  // ── Auto-save (debounced) ────────────────────────────────
  const persistEntry = useCallback(async (newSaves: Record<string, ExerciseSave>, si: number) => {
    if (!planId || saving) return
    setSaving(true)
    const notes: NotesV2 = { v: 2, sectionIdx: si, exercises: newSaves }
    const doneCount = Object.values(newSaves).filter(s => s.done).length
    await upsertTrainingEntry({
      user_id: userId,
      training_plan_id: planId,
      date: today,
      completed: doneCount > 0,
      notes: JSON.stringify(notes),
    })
    setSaving(false)
  }, [planId, userId, today, saving])

  function scheduleSave(newSaves: Record<string, ExerciseSave>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistEntry(newSaves, sectionIdx), 800)
  }

  // ── Exercise state helpers ───────────────────────────────
  function getSave(id: string): ExerciseSave {
    return saves[id] ?? (prevSaves[id] ? { done: false, sets: prevSaves[id].sets } : defaultSave())
  }

  function toggleDone(id: string) {
    const current = getSave(id)
    const next = { ...current, done: !current.done }
    const newSaves = { ...saves, [id]: next }
    setSaves(newSaves)
    scheduleSave(newSaves)
  }

  function updateSet(id: string, setIdx: number, field: keyof ExerciseLoad, value: string) {
    const current = getSave(id)
    const newSets = current.sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s)
    const next = { ...current, sets: newSets }
    const newSaves = { ...saves, [id]: next }
    setSaves(newSaves)
    scheduleSave(newSaves)
  }

  function addSet(id: string) {
    const current = getSave(id)
    const last = current.sets[current.sets.length - 1] ?? emptyLoad()
    const next = { ...current, sets: [...current.sets, { ...last }] }
    const newSaves = { ...saves, [id]: next }
    setSaves(newSaves)
    scheduleSave(newSaves)
  }

  function removeSet(id: string) {
    const current = getSave(id)
    if (current.sets.length <= 1) return
    const next = { ...current, sets: current.sets.slice(0, -1) }
    const newSaves = { ...saves, [id]: next }
    setSaves(newSaves)
    scheduleSave(newSaves)
  }

  function collapseAndSave(id: string) {
    setExpandedId(null)
    const current = getSave(id)
    // Mark done when saving with at least one set that has weight
    const hasLoad = current.sets.some(s => s.weight.trim() !== '')
    if (hasLoad && !current.done) {
      const next = { ...current, done: true }
      const newSaves = { ...saves, [id]: next }
      setSaves(newSaves)
      persistEntry(newSaves, sectionIdx)
    } else {
      persistEntry(saves, sectionIdx)
    }
  }

  // ── Import flow ──────────────────────────────────────────
  async function handleImportResult(result: FileImportResult) {
    setShowImport(false)
    const parsed = parseTrainingImport(result)
    setImportReview({ result, parsed })
  }

  async function confirmImport(parsed: ParsedTrainingPlan) {
    if (!importReview) return
    const { result } = importReview
    const title = `Treino · ${result.meta.fileName}`
    const { data, error } = await saveTrainingPlan({
      user_id: userId,
      title,
      source_type: result.kind,
      source_file_name: result.meta.fileName,
      summary: parsed.summary ?? null,
      raw_content: { ...result, parsedPlan: parsed },
    })
    if (error || !data) { toast.error('Erro ao guardar plano'); return }
    setImportReview(null)
    const newPlans = await getTrainingPlans(userId) as TrainingPlan[]
    setPlans(newPlans)
    toast.success('Plano importado!')
    // Open selector with the new plan pre-expanded
    setShowSelector(true)
  }

  async function handleDeletePlan(id: string) {
    const { error } = await deleteTrainingPlan(id, userId)
    if (error) return
    const newPlans = plans.filter(p => p.id !== id)
    setPlans(newPlans)
    if (planId === id) {
      setPlanId(null); setSectionTitle('')
      sessionStorage.removeItem(sessionKey(today))
    }
    toast.success('Plano eliminado')
  }

  // ── Derived data ─────────────────────────────────────────
  const selectedPlan = plans.find(p => p.id === planId) ?? null
  const parsed = getParsed(selectedPlan)
  const exercises = parsed?.sections[sectionIdx]?.exercises ?? []
  const doneCount = exercises.filter(e => saves[e.id]?.done).length

  // ── Render helpers ───────────────────────────────────────
  function setLabel(save: ExerciseSave): string {
    const validSets = save.sets.filter(s => s.weight || s.reps)
    if (!validSets.length) return ''
    const first = validSets[0]
    const allSameWeight = validSets.every(s => s.weight === first.weight)
    const allSameReps = validSets.every(s => s.reps === first.reps)
    const wStr = first.weight ? `${first.weight}kg` : ''
    const rStr = first.reps ? `× ${first.reps}` : ''
    const setStr = `${validSets.length}s`
    if (allSameWeight && allSameReps) return [setStr, wStr, rStr].filter(Boolean).join(' · ')
    return `${setStr} · variado`
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div>
      {/* Header bar */}
      {planId && parsed ? (
        <div style={{
          background: 'var(--bg2)', borderRadius: 14, padding: '12px 14px',
          border: '0.5px solid var(--border)', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>
              {selectedPlan?.title}
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>
              {sectionTitle}
            </div>
          </div>
          <button onClick={() => setShowSelector(true)} style={{
            background: 'var(--bg3)', border: 'none', borderRadius: 9,
            padding: '7px 12px', color: 'var(--text2)', fontFamily: 'Syne, sans-serif',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>
            Trocar
          </button>
        </div>
      ) : (
        <button onClick={() => plans.length > 0 ? setShowSelector(true) : setShowImport(true)} style={{
          width: '100%', background: 'rgba(232,168,56,.08)',
          border: '0.5px dashed var(--gold)', borderRadius: 14, padding: '20px 16px',
          color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 700,
          fontSize: 15, cursor: 'pointer', marginBottom: 12,
        }}>
          🏋️ Começar treino
        </button>
      )}

      {/* Progress bar */}
      {exercises.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Progresso</span>
            <span style={{ fontSize: 12, color: doneCount === exercises.length ? 'var(--teal)' : 'var(--text3)' }}>
              {doneCount}/{exercises.length} exercícios {doneCount === exercises.length ? '✓' : ''}
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--teal)',
              width: `${exercises.length ? (doneCount / exercises.length) * 100 : 0}%`,
              transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercises.map(ex => {
            const save = getSave(ex.id)
            const isExpanded = expandedId === ex.id
            const label = setLabel(save)

            return (
              <div key={ex.id} style={{
                background: 'var(--bg2)', borderRadius: 14,
                border: `0.5px solid ${save.done ? 'rgba(30,203,180,.4)' : 'var(--border)'}`,
                overflow: 'hidden', transition: 'border-color .2s',
              }}>
                {/* Collapsed row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                  {/* Checkbox */}
                  <button onClick={() => toggleDone(ex.id)} style={{
                    width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${save.done ? 'var(--teal)' : 'var(--border)'}`,
                    background: save.done ? 'var(--teal)' : 'transparent',
                    cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--bg0)', fontSize: 12, fontWeight: 700,
                  }}>
                    {save.done ? '✓' : ''}
                  </button>

                  {/* Name + summary */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: save.done ? 'var(--text3)' : 'var(--text1)',
                      textDecoration: save.done ? 'line-through' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {ex.name}
                    </div>
                    {label && (
                      <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2 }}>{label}</div>
                    )}
                    {ex.detail && !label && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{ex.detail}</div>
                    )}
                  </div>

                  {/* Expand toggle */}
                  <button onClick={() => setExpandedId(isExpanded ? null : ex.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: 13, padding: '4px 6px',
                    transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
                  }}>▾</button>
                </div>

                {/* Expanded: set inputs */}
                {isExpanded && (
                  <div style={{ borderTop: '0.5px solid var(--border)', padding: '12px 14px' }}>
                    {save.sets.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', width: 50, flexShrink: 0 }}>
                          Série {idx + 1}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="kg"
                          value={s.weight}
                          onChange={e => updateSet(ex.id, idx, 'weight', e.target.value)}
                          style={{
                            flex: 1, background: 'var(--bg3)', border: '0.5px solid var(--border)',
                            borderRadius: 8, padding: '8px 10px', color: 'var(--text1)',
                            fontSize: 13, outline: 'none', textAlign: 'center',
                          }}
                        />
                        <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0 }}>kg ×</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="reps"
                          value={s.reps}
                          onChange={e => updateSet(ex.id, idx, 'reps', e.target.value)}
                          style={{
                            flex: 1, background: 'var(--bg3)', border: '0.5px solid var(--border)',
                            borderRadius: 8, padding: '8px 10px', color: 'var(--text1)',
                            fontSize: 13, outline: 'none', textAlign: 'center',
                          }}
                        />
                      </div>
                    ))}

                    {/* Set controls */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => addSet(ex.id)} style={{
                        background: 'var(--bg3)', border: 'none', borderRadius: 8,
                        padding: '7px 12px', color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
                      }}>+ Série</button>
                      {save.sets.length > 1 && (
                        <button onClick={() => removeSet(ex.id)} style={{
                          background: 'var(--bg3)', border: 'none', borderRadius: 8,
                          padding: '7px 12px', color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
                        }}>− Série</button>
                      )}
                      <button onClick={() => collapseAndSave(ex.id)} style={{
                        flex: 1, background: 'var(--gold)', color: 'var(--bg0)',
                        border: 'none', borderRadius: 8, padding: '7px 12px',
                        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      }}>
                        Guardar ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Plan history */}
      {plans.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Planos importados
          </div>
          {plans.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--bg2)', borderRadius: 12,
              border: '0.5px solid var(--border)', marginBottom: 6,
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{p.source_type?.toUpperCase()}</div>
              </div>
              <button onClick={() => handleDeletePlan(p.id)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: 16, cursor: 'pointer', padding: '4px 8px',
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Import button */}
      <button onClick={() => setShowImport(true)} style={{
        marginTop: 16, width: '100%', background: 'none',
        border: '0.5px dashed var(--border)', borderRadius: 12,
        padding: '11px 14px', color: 'var(--text3)',
        fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
      }}>
        + Importar plano de treino
      </button>

      {saving && (
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
          A guardar…
        </div>
      )}

      {/* Modals */}
      {showSelector && (
        <PlanSelector
          plans={plans}
          onSelect={selectSection}
          onClose={() => setShowSelector(false)}
          onImport={() => { setShowSelector(false); setShowImport(true) }}
        />
      )}

      {showImport && (
        <FileImportModal
          title="Importar treino"
          accept=".pdf,.xlsx,.xls,.csv"
          onClose={() => setShowImport(false)}
          onResult={handleImportResult}
        />
      )}

      {importReview && (
        <PlanReviewModal
          mode="training"
          plan={importReview.parsed}
          onConfirm={p => confirmImport(p as ParsedTrainingPlan)}
          onCancel={() => setImportReview(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. If `FileImportModal` props don't match (e.g. `onResult` vs `onImport`), check `src/components/FileImportModal.tsx` and adjust the prop names to match.

- [ ] **Step 3: Commit**

```bash
git add src/components/corpo/WorkoutTracker.tsx
git commit -m "feat: WorkoutTracker — exercise tracking with sets, load memory, import flow"
```

---

## Task 4: DietTracker Component

**Files:**
- Create: `src/components/corpo/DietTracker.tsx`

- [ ] **Step 1: Create `src/components/corpo/DietTracker.tsx`**

```typescript
// src/components/corpo/DietTracker.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import { useToast } from '@/components/Toast'
import { getDietPlans, saveDietPlan } from '@/lib/supabase'
import { getDietMeals, upsertDietMeal, deleteDietPlan } from '@/lib/body'
import { parseDietImport, type ParsedDietPlan, type FileImportResult } from '@/lib/body-plan'
import type { DietPlan, DietMeal, DietMealKey } from '@/types'

const MEALS: Array<{ key: DietMealKey; label: string; icon: string }> = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoço', icon: '🍳' },
  { key: 'almoco',         label: 'Almoço',         icon: '🍽️' },
  { key: 'lanche',         label: 'Lanche',         icon: '🥤' },
  { key: 'jantar',         label: 'Jantar',         icon: '🌙' },
]

type MealNotesPayload = { freeText: string; items?: Record<string, boolean> }

function parseMealNotes(raw: string | null | undefined): MealNotesPayload {
  if (!raw) return { freeText: '', items: {} }
  try {
    const p = JSON.parse(raw)
    return { freeText: p.freeText ?? '', items: p.items ?? {} }
  } catch { return { freeText: raw, items: {} } }
}

function getParsed(plan: DietPlan | null): ParsedDietPlan | null {
  if (!plan?.raw_content) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedDietPlan }
  return raw.parsedPlan ?? null
}

interface Props {
  userId: string
  today: string
  initialPlans: DietPlan[]
}

export default function DietTracker({ userId, today, initialPlans }: Props) {
  const toast = useToast()
  const [plans, setPlans]         = useState<DietPlan[]>(initialPlans)
  const [selectedId, setSelectedId] = useState<string | null>(initialPlans[0]?.id ?? null)
  const [meals, setMeals]         = useState<DietMeal[]>([])
  const [mealNotes, setMealNotes] = useState<Record<string, string>>({})
  const [showImport, setShowImport] = useState(false)
  const [importReview, setImportReview] = useState<{ result: FileImportResult; parsed: ParsedDietPlan } | null>(null)
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!userId) return
    getDietMeals(userId, today).then(data => {
      const m = (data ?? []) as DietMeal[]
      setMeals(m)
      const notes: Record<string, string> = {}
      m.forEach(meal => { notes[meal.meal_key] = parseMealNotes(meal.notes).freeText })
      setMealNotes(notes)
    })
  }, [userId, today])

  const selectedPlan = plans.find(p => p.id === selectedId) ?? null
  const parsed = getParsed(selectedPlan)

  function getMealLog(key: DietMealKey): DietMeal | undefined {
    return meals.find(m => m.diet_plan_id === selectedId && m.meal_key === key)
  }

  async function toggleMeal(key: DietMealKey) {
    if (!selectedId) return
    const current = getMealLog(key)
    const next = !(current?.completed ?? false)
    const payload = {
      user_id: userId,
      diet_plan_id: selectedId,
      date: today,
      meal_key: key,
      completed: next,
      notes: current?.notes ?? null,
    }
    const { data, error } = await upsertDietMeal(payload)
    if (error) return
    setMeals(prev => {
      const filtered = prev.filter(m => !(m.diet_plan_id === selectedId && m.meal_key === key))
      return data ? [...filtered, data as DietMeal] : filtered
    })
  }

  function handleNoteChange(key: DietMealKey, text: string) {
    setMealNotes(prev => ({ ...prev, [key]: text }))
    if (noteTimers.current[key]) clearTimeout(noteTimers.current[key])
    noteTimers.current[key] = setTimeout(async () => {
      if (!selectedId) return
      const current = getMealLog(key)
      const parsed = parseMealNotes(current?.notes)
      const notes = JSON.stringify({ ...parsed, freeText: text })
      await upsertDietMeal({
        user_id: userId, diet_plan_id: selectedId, date: today,
        meal_key: key, completed: current?.completed ?? false, notes,
      })
    }, 1000)
  }

  async function handleImportResult(result: FileImportResult) {
    setShowImport(false)
    const p = parseDietImport(result)
    setImportReview({ result, parsed: p })
  }

  async function confirmImport(parsed: ParsedDietPlan) {
    if (!importReview) return
    const { result } = importReview
    const { data, error } = await saveDietPlan({
      user_id: userId,
      title: `Dieta · ${result.meta.fileName}`,
      source_type: result.kind,
      source_file_name: result.meta.fileName,
      summary: parsed.summary ?? null,
      raw_content: { ...result, parsedPlan: parsed },
    })
    if (error || !data) { toast.error('Erro ao guardar dieta'); return }
    setImportReview(null)
    const newPlans = await getDietPlans(userId) as DietPlan[]
    setPlans(newPlans)
    setSelectedId(data.id as string)
    toast.success('Dieta importada!')
  }

  async function handleDelete(id: string) {
    const { error } = await deleteDietPlan(id, userId)
    if (error) return
    const newPlans = plans.filter(p => p.id !== id)
    setPlans(newPlans)
    if (selectedId === id) setSelectedId(newPlans[0]?.id ?? null)
    toast.success('Dieta eliminada')
  }

  return (
    <div>
      {/* Plan selector */}
      {plans.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 12, padding: '11px 14px', color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
            }}
          >
            {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      )}

      {/* Meals */}
      {parsed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MEALS.map(({ key, label, icon }) => {
            const mealPlan = parsed.meals.find(m => m.key === key)
            if (!mealPlan || mealPlan.items.length === 0) return null
            const log = getMealLog(key)
            const done = log?.completed ?? false

            return (
              <div key={key} style={{
                background: 'var(--bg2)', borderRadius: 14,
                border: `0.5px solid ${done ? 'rgba(30,203,180,.4)' : 'var(--border)'}`,
                overflow: 'hidden',
              }}>
                {/* Meal header */}
                <div style={{
                  padding: '12px 14px', display: 'flex',
                  alignItems: 'center', gap: 10,
                  borderBottom: '0.5px solid var(--border)',
                }}>
                  <button onClick={() => toggleMeal(key)} style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `1.5px solid ${done ? 'var(--teal)' : 'var(--border)'}`,
                    background: done ? 'var(--teal)' : 'transparent',
                    cursor: 'pointer', flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--bg0)', fontSize: 12, fontWeight: 700,
                  }}>{done ? '✓' : ''}</button>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 700,
                    fontSize: 13, color: done ? 'var(--text3)' : 'var(--text1)',
                  }}>{label}</span>
                </div>

                {/* Items */}
                <div style={{ padding: '8px 14px 4px' }}>
                  {mealPlan.items.map((item, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: 'var(--text2)', padding: '4px 0',
                      borderBottom: i < mealPlan.items.length - 1 ? '0.5px solid var(--border)' : 'none',
                    }}>
                      · {item}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div style={{ padding: '8px 14px 12px' }}>
                  <input
                    placeholder="Notas da refeição…"
                    value={mealNotes[key] ?? ''}
                    onChange={e => handleNoteChange(key, e.target.value)}
                    style={{
                      width: '100%', background: 'var(--bg3)',
                      border: '0.5px solid var(--border)', borderRadius: 8,
                      padding: '7px 10px', color: 'var(--text2)',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🥗</div>
          Nenhuma dieta importada.
        </div>
      )}

      {/* Plan history + delete */}
      {plans.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Dietas importadas
          </div>
          {plans.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--bg2)', borderRadius: 12,
              border: '0.5px solid var(--border)', marginBottom: 6,
            }}>
              <span style={{ fontSize: 13, color: 'var(--text1)' }}>{p.title}</span>
              <button onClick={() => handleDelete(p.id)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: 16, cursor: 'pointer', padding: '4px 8px',
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowImport(true)} style={{
        marginTop: 16, width: '100%', background: 'none',
        border: '0.5px dashed var(--border)', borderRadius: 12,
        padding: '11px 14px', color: 'var(--text3)',
        fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
      }}>
        + Importar plano de dieta
      </button>

      {showImport && (
        <FileImportModal
          title="Importar dieta"
          accept=".pdf,.xlsx,.xls,.csv"
          onClose={() => setShowImport(false)}
          onResult={handleImportResult}
        />
      )}

      {importReview && (
        <PlanReviewModal
          mode="diet"
          plan={importReview.parsed}
          onConfirm={p => confirmImport(p as ParsedDietPlan)}
          onCancel={() => setImportReview(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/corpo/DietTracker.tsx
git commit -m "feat: DietTracker — extracted diet tab with meal tracking and import"
```

---

## Task 5: WeightLog Component

**Files:**
- Create: `src/components/corpo/WeightLog.tsx`

- [ ] **Step 1: Create `src/components/corpo/WeightLog.tsx`**

```typescript
// src/components/corpo/WeightLog.tsx
'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { useToast } from '@/components/Toast'
import { getWeightLogs, upsertWeightLog, deleteWeightLog, type WeightLog } from '@/lib/body'

type Filter = 30 | 90 | 0

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0]
}

interface Props { userId: string }

export default function WeightLog({ userId }: Props) {
  const toast = useToast()
  const [logs, setLogs]     = useState<WeightLog[]>([])
  const [filter, setFilter] = useState<Filter>(30)
  const [weightIn, setWeightIn] = useState('')
  const [dateIn, setDateIn]   = useState(getLocalDateString())
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }, [userId, filter])

  async function handleSave() {
    const kg = parseFloat(weightIn.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || kg > 500) { toast.error('Peso inválido'); return }
    setSaving(true)
    const { error } = await upsertWeightLog(userId, dateIn, kg)
    setSaving(false)
    if (error) return
    toast.success('Peso registado!')
    setWeightIn('')
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }

  async function handleDelete(id: string) {
    const { error } = await deleteWeightLog(userId, id)
    if (error) return
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const chartData = logs.map(l => ({
    date: format(new Date(l.date + 'T12:00:00'), 'd MMM', { locale: pt }),
    kg: Number(l.weight_kg),
  }))

  const latest = logs[logs.length - 1]
  const first  = logs[0]
  const delta  = latest && first && logs.length > 1
    ? (Number(latest.weight_kg) - Number(first.weight_kg)).toFixed(1)
    : null

  return (
    <div>
      {/* Input row */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Data</label>
          <input
            type="date"
            value={dateIn}
            onChange={e => setDateIn(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 12, padding: '11px 12px', color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Peso (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="75.4"
            value={weightIn}
            onChange={e => setWeightIn(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{
              width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 12, padding: '11px 12px', color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <button onClick={handleSave} disabled={saving || !weightIn} style={{
          background: weightIn ? 'var(--gold)' : 'var(--bg3)',
          color: weightIn ? 'var(--bg0)' : 'var(--text3)',
          border: 'none', borderRadius: 12, padding: '11px 16px',
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          flexShrink: 0,
        }}>
          {saving ? '…' : 'Registar'}
        </button>
      </div>

      {/* Stats row */}
      {latest && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{
            flex: 1, background: 'var(--bg2)', border: '0.5px solid var(--border)',
            borderRadius: 12, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Último</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>
              {Number(latest.weight_kg).toFixed(1)} <span style={{ fontSize: 12, color: 'var(--text3)' }}>kg</span>
            </div>
          </div>
          {delta !== null && (
            <div style={{
              flex: 1, background: 'var(--bg2)', border: '0.5px solid var(--border)',
              borderRadius: 12, padding: '12px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Variação</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: Number(delta) <= 0 ? 'var(--teal)' : 'var(--gold)' }}>
                {Number(delta) > 0 ? '+' : ''}{delta} <span style={{ fontSize: 12, color: 'var(--text3)' }}>kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {logs.length > 1 && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 4px 8px', marginBottom: 16 }}>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', paddingRight: 12, marginBottom: 8 }}>
            {([30, 90, 0] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? 'var(--gold)' : 'var(--bg3)',
                color: filter === f ? 'var(--bg0)' : 'var(--text3)',
                border: 'none', borderRadius: 8, padding: '4px 10px',
                fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
              }}>{f === 0 ? 'Tudo' : `${f}d`}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'var(--text3)' }}
                tickFormatter={v => `${v}`}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v} kg`, 'Peso']}
              />
              <Line
                type="monotone" dataKey="kg" stroke="var(--teal)"
                strokeWidth={2} dot={{ r: 3, fill: 'var(--teal)' }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History list */}
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
          Sem registos ainda.<br />Regista o teu peso acima.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Histórico
          </div>
          {[...logs].reverse().map(log => (
            <div key={log.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'var(--bg2)', borderRadius: 12,
              border: '0.5px solid var(--border)', marginBottom: 6,
            }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>
                  {Number(log.weight_kg).toFixed(1)} kg
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 10 }}>
                  {format(new Date(log.date + 'T12:00:00'), "d 'de' MMM", { locale: pt })}
                </span>
              </div>
              <button onClick={() => handleDelete(log.id)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: 16, cursor: 'pointer', padding: '4px 8px',
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/corpo/WeightLog.tsx
git commit -m "feat: WeightLog — weight tracking with Recharts chart and history"
```

---

## Task 6: Corpo Page Orchestrator

**Files:**
- Replace: `src/app/corpo/page.tsx`

- [ ] **Step 1: Check FileImportModal props**

Before writing the page, check what props `FileImportModal` actually accepts:

```bash
grep -n "interface\|onResult\|onImport\|accept\|title" src/components/FileImportModal.tsx | head -20
```

Note the exact prop names — use them in WorkoutTracker and DietTracker if they differ from `onResult`.

- [ ] **Step 2: Replace `src/app/corpo/page.tsx`**

```typescript
// src/app/corpo/page.tsx
'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import WorkoutTracker from '@/components/corpo/WorkoutTracker'
import DietTracker from '@/components/corpo/DietTracker'
import WeightLog from '@/components/corpo/WeightLog'
import { supabase, getTrainingPlans, getDietPlans } from '@/lib/supabase'
import type { TrainingPlan, DietPlan } from '@/types'

type BodyTab = 'treino' | 'dieta' | 'peso'

const TABS: { key: BodyTab; label: string; icon: string }[] = [
  { key: 'treino', label: 'Treino', icon: '🏋️' },
  { key: 'dieta',  label: 'Dieta',  icon: '🥗' },
  { key: 'peso',   label: 'Peso',   icon: '⚖️' },
]

function getLocalDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

export default function CorpoPage() {
  const [tab, setTab]                   = useState<BodyTab>('treino')
  const [userId, setUserId]             = useState<string | null>(null)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([])
  const [dietPlans, setDietPlans]       = useState<DietPlan[]>([])
  const [loading, setLoading]           = useState(true)
  const today = getLocalDate()

  useEffect(() => {
    let active = true
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      if (!active) return
      const [training, diet] = await Promise.all([
        getTrainingPlans(user.id),
        getDietPlans(user.id),
      ])
      if (!active) return
      setUserId(user.id)
      setTrainingPlans((training ?? []) as TrainingPlan[])
      setDietPlans((diet ?? []) as DietPlan[])
      setLoading(false)
    }
    bootstrap()
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>A carregar…</div>
      </main>
    )
  }

  if (!userId) return null

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 16 }}>
          Corpo
        </h1>

        {/* Tab bar */}
        <div style={{
          display: 'flex', background: 'var(--bg2)', borderRadius: 14,
          padding: 4, gap: 3, border: '0.5px solid var(--border)', marginBottom: 20,
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: tab === t.key ? 'var(--bg1)' : 'transparent',
              color: tab === t.key ? 'var(--gold)' : 'var(--text3)',
              transition: 'all .15s', fontSize: 9,
              fontFamily: 'Syne, sans-serif', fontWeight: tab === t.key ? 600 : 400,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'treino' && (
          <WorkoutTracker
            userId={userId}
            today={today}
            initialPlans={trainingPlans}
          />
        )}
        {tab === 'dieta' && (
          <DietTracker
            userId={userId}
            today={today}
            initialPlans={dietPlans}
          />
        )}
        {tab === 'peso' && (
          <WeightLog userId={userId} />
        )}
      </div>

      <Nav />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Fix any errors — common issues:
- `FileImportModal` prop name mismatch (`onResult` vs actual prop)
- `ParsedTrainingPlan` / `ParsedDietPlan` imports in sub-components
- `saveTrainingPlan` / `saveDietPlan` type for return `data`

- [ ] **Step 4: Fix FileImportModal prop names if needed**

Check actual props:
```bash
grep -n "Props\|interface\|onResult\|onFile\|onImport" src/components/FileImportModal.tsx
```

If the prop is e.g. `onFile` instead of `onResult`, update both `WorkoutTracker.tsx` and `DietTracker.tsx` accordingly.

- [ ] **Step 5: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/corpo/page.tsx
git commit -m "feat: corpo page — 3-tab orchestrator (Treino/Dieta/Peso)"
```

---

## Task 7: Push and Verify

- [ ] **Step 1: Push to remote**

```bash
git push origin main
```

- [ ] **Step 2: Run SQL migration in Supabase**

If not done in Task 1, run the SQL now:

```sql
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON body_measurements
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 3: Verify on Vercel after deploy**

Success criteria:
- [ ] Tab "Treino": "Começar treino" appears → PlanSelector opens → pick a section → exercise list shows
- [ ] Exercise row: tap to expand → enter weight × reps → "Guardar ✓" → row collapses with summary "3s · 80kg × 10"
- [ ] Progress bar updates as exercises marked done
- [ ] Import a plan → review modal scrolls → confirm → PlanSelector auto-opens
- [ ] Tab "Dieta": meals visible with checkboxes + notes
- [ ] Tab "Peso": enter weight → appears in chart and history list
- [ ] Delete a plan → disappears from list
- [ ] Refresh page → today's selection restored from sessionStorage
