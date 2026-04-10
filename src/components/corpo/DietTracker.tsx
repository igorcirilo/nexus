'use client'

import { useEffect, useRef, useState } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import { useToast } from '@/components/Toast'
import { getDietPlans, saveDietPlan } from '@/lib/supabase'
import { getDietMeals, upsertDietMeal, deleteDietPlan } from '@/lib/body'
import { parseDietImport, type ParsedDietPlan } from '@/lib/body-plan'
import type { DietPlan, DietMeal, DietMealKey, FileImportResult } from '@/types'

// ── Meal config ────────────────────────────────────────────────────────────────

const MEALS = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoço', icon: '🍳' },
  { key: 'almoco',         label: 'Almoço',         icon: '🍽️' },
  { key: 'lanche',         label: 'Lanche',         icon: '🥤' },
  { key: 'jantar',         label: 'Jantar',         icon: '🌙' },
] as const

// ── Notes helper ───────────────────────────────────────────────────────────────

type MealNotesPayload = { freeText: string; items?: Record<string, boolean> }

function parseMealNotes(raw: string | null | undefined): MealNotesPayload {
  if (!raw) return { freeText: '' }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'freeText' in parsed) {
      return parsed as MealNotesPayload
    }
    // Plain string — treat as freeText
    return { freeText: raw }
  } catch {
    return { freeText: raw }
  }
}

// ── Plan helper ────────────────────────────────────────────────────────────────

function getParsed(plan: DietPlan | null): ParsedDietPlan | null {
  if (!plan) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedDietPlan } | null
  return raw?.parsedPlan ?? null
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  today: string   // YYYY-MM-DD
  initialPlans: DietPlan[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DietTracker({ userId, today, initialPlans }: Props) {
  const toast = useToast()

  const [plans, setPlans] = useState<DietPlan[]>(initialPlans)
  const [selectedId, setSelectedId] = useState<string | null>(initialPlans[0]?.id ?? null)
  const [meals, setMeals] = useState<DietMeal[]>([])
  const [mealNotes, setMealNotes] = useState<Record<string, string>>({})
  const [showImport, setShowImport] = useState(false)
  const [importReview, setImportReview] = useState<{ result: FileImportResult; parsed: ParsedDietPlan } | null>(null)
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── On mount: load today's meals ────────────────────────────────────────────

  useEffect(() => {
    async function loadMeals() {
      const data = await getDietMeals(userId, today)
      const typedData = data as DietMeal[]
      setMeals(typedData)
      const notes: Record<string, string> = {}
      for (const meal of typedData) {
        const payload = parseMealNotes(meal.notes)
        notes[meal.meal_key] = payload.freeText
      }
      setMealNotes(notes)
    }
    loadMeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const selectedPlan = plans.find(p => p.id === selectedId) ?? null
  const parsed = getParsed(selectedPlan)

  function getMealLog(key: DietMealKey): DietMeal | undefined {
    return meals.find(m => m.diet_plan_id === selectedId && m.meal_key === key)
  }

  // ── Toggle meal ───────────────────────────────────────────────────────────────

  async function toggleMeal(key: DietMealKey) {
    if (!selectedId) return
    const existing = getMealLog(key)
    const newCompleted = !(existing?.completed ?? false)
    const notes = mealNotes[key] ?? null
    const notesPayload: MealNotesPayload = { freeText: notes ?? '' }

    const { data } = await upsertDietMeal({
      user_id: userId,
      diet_plan_id: selectedId,
      date: today,
      meal_key: key,
      completed: newCompleted,
      notes: JSON.stringify(notesPayload),
    })

    if (data) {
      const updated = data as DietMeal
      setMeals(prev => {
        const idx = prev.findIndex(m => m.diet_plan_id === selectedId && m.meal_key === key)
        if (idx >= 0) {
          return prev.map((m, i) => (i === idx ? updated : m))
        }
        return [...prev, updated]
      })
    }
  }

  // ── Note change (debounced 1000ms) ───────────────────────────────────────────

  function handleNoteChange(key: DietMealKey, text: string) {
    setMealNotes(prev => ({ ...prev, [key]: text }))

    if (noteTimers.current[key]) clearTimeout(noteTimers.current[key])
    noteTimers.current[key] = setTimeout(async () => {
      if (!selectedId) return
      const existing = getMealLog(key)
      const notesPayload: MealNotesPayload = { freeText: text }
      const { data } = await upsertDietMeal({
        user_id: userId,
        diet_plan_id: selectedId,
        date: today,
        meal_key: key,
        completed: existing?.completed ?? false,
        notes: JSON.stringify(notesPayload),
      })
      if (data) {
        const updated = data as DietMeal
        setMeals(prev => {
          const idx = prev.findIndex(m => m.diet_plan_id === selectedId && m.meal_key === key)
          if (idx >= 0) return prev.map((m, i) => (i === idx ? updated : m))
          return [...prev, updated]
        })
      }
    }, 1000)
  }

  // ── Import flow ───────────────────────────────────────────────────────────────

  async function handleImportConfirm(result: FileImportResult) {
    const dietParsed = parseDietImport(result)
    setImportReview({ result, parsed: dietParsed })
    setShowImport(false)
  }

  async function confirmImport(parsedPlan: ParsedDietPlan) {
    const fileName = importReview?.result.meta.fileName ?? 'dieta'
    const title = parsedPlan.summary
      ? parsedPlan.summary.slice(0, 60)
      : fileName.replace(/\.[^.]+$/, '')

    const saved = await saveDietPlan({
      user_id: userId,
      title,
      source_type: importReview?.result.kind ?? 'pdf',
      source_file_name: fileName,
      summary: parsedPlan.summary ?? null,
      raw_content: { parsedPlan },
    })

    const updated = await getDietPlans(userId)
    const typedUpdated = (updated as DietPlan[]) ?? []
    setPlans(typedUpdated)

    // Select the newly saved plan
    const newPlanId = (saved as { id?: string } | null)?.id ?? typedUpdated[0]?.id ?? null
    setSelectedId(newPlanId)

    setImportReview(null)
    toast.success('Dieta importada!')
  }

  async function handleDelete(id: string) {
    await deleteDietPlan(id, userId)
    setPlans(prev => {
      const next = prev.filter(p => p.id !== id)
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Plan selector dropdown (only if plans.length > 1) ───────────── */}
      {plans.length > 1 && (
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value || null)}
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: 'var(--text1)',
            width: '100%',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {plans.map(plan => (
            <option key={plan.id} value={plan.id}>
              {plan.title}
            </option>
          ))}
        </select>
      )}

      {/* ── Meal cards (only if parsed exists) ──────────────────────────── */}
      {parsed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MEALS.map(meal => {
            const mealPlan = parsed.meals.find(m => m.key === meal.key)
            if (!mealPlan || mealPlan.items.length === 0) return null
            const log = getMealLog(meal.key as DietMealKey)
            const done = log?.completed ?? false
            const noteText = mealNotes[meal.key] ?? ''

            return (
              <div
                key={meal.key}
                style={{
                  background: 'var(--bg1)',
                  border: `1px solid ${done ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleMeal(meal.key as DietMealKey)}
                    aria-label={done ? 'Marcar como não feito' : 'Marcar como feito'}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: done ? 'none' : '2px solid var(--border)',
                      background: done ? 'var(--teal)' : 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    {done ? '✓' : ''}
                  </button>

                  {/* Icon + label */}
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{meal.icon}</span>
                  <span
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontSize: 15,
                      fontWeight: 700,
                      color: done ? 'var(--teal)' : 'var(--text1)',
                      flex: 1,
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.8 : 1,
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {meal.label}
                  </span>
                </div>

                {/* Items list */}
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mealPlan.items.map((item, idx) => (
                    <p
                      key={idx}
                      style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 13,
                        color: done ? 'var(--text3)' : 'var(--text2)',
                        margin: 0,
                        lineHeight: 1.5,
                        textDecoration: done ? 'line-through' : 'none',
                        opacity: done ? 0.7 : 1,
                      }}
                    >
                      · {item}
                    </p>
                  ))}
                </div>

                {/* Notes input */}
                <div style={{ padding: '0 14px 12px' }}>
                  <textarea
                    value={noteText}
                    onChange={e => handleNoteChange(meal.key as DietMealKey, e.target.value)}
                    placeholder="Notas (opcional)…"
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 12,
                      color: 'var(--text1)',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Empty state ──────────────────────────────────────────────── */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '48px 24px',
          }}
        >
          <span style={{ fontSize: 48 }}>🥗</span>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 15,
              color: 'var(--text2)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Nenhuma dieta importada.
          </p>
        </div>
      )}

      {/* ── Plan history ──────────────────────────────────────────────────── */}
      {plans.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              color: 'var(--text3)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 8px',
            }}
          >
            Dietas Importadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plans.map(plan => (
              <div
                key={plan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: 'var(--bg1)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 13,
                    color: plan.id === selectedId ? 'var(--teal)' : 'var(--text2)',
                    margin: 0,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: plan.id === selectedId ? 600 : 400,
                  }}
                >
                  {plan.title}
                </p>
                <button
                  onClick={() => handleDelete(plan.id)}
                  aria-label="Remover dieta"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 4,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Import button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowImport(true)}
        style={{
          background: 'none',
          border: '1.5px dashed var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text2)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          width: '100%',
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--teal)',
          }}
        >
          +
        </span>
        Importar plano de dieta
      </button>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      <FileImportModal
        open={showImport}
        title="Importar plano de dieta"
        kind="mixed"
        onClose={() => setShowImport(false)}
        onConfirm={handleImportConfirm}
      />

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
