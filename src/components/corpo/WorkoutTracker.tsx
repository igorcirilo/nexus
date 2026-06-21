'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import PlanSelector from '@/components/corpo/PlanSelector'
import EmptyState from '@/components/EmptyState'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/Toast'
import { getTrainingPlans, saveTrainingPlan } from '@/lib/supabase'
import {
  getTrainingEntries,
  getPrevTrainingEntry,
  upsertTrainingEntry,
  deleteTrainingPlan,
} from '@/lib/body'
import { parseTrainingImport, type ParsedTrainingPlan, type TrainingExercisePlan } from '@/lib/body-plan'
import type { TrainingPlan, FileImportResult } from '@/types'

// ── Internal Types ─────────────────────────────────────────────────────────────

type ExerciseLoad = { weight: string; reps: string }
type ExerciseSave = { done: boolean; sets: ExerciseLoad[] }
type NotesV2 = { v: 2; sectionIdx: number; exercises: Record<string, ExerciseSave> }

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyLoad(): ExerciseLoad {
  return { weight: '', reps: '' }
}

function defaultSave(): ExerciseSave {
  return { done: false, sets: [emptyLoad()] }
}

function parseNotes(raw: string | null | undefined): NotesV2 {
  const empty: NotesV2 = { v: 2, sectionIdx: 0, exercises: {} }
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw)
    // Already v2
    if (parsed && parsed.v === 2) return parsed as NotesV2
    // Old format migration: { exercises: { [id]: { checked, load } } }
    if (parsed && parsed.exercises && typeof parsed.exercises === 'object') {
      const exercises: Record<string, ExerciseSave> = {}
      for (const [id, val] of Object.entries(parsed.exercises)) {
        const old = val as { checked?: boolean; load?: string }
        exercises[id] = {
          done: old.checked ?? false,
          sets: [{ weight: old.load ?? '', reps: '' }],
        }
      }
      return { v: 2, sectionIdx: parsed.sectionIdx ?? 0, exercises }
    }
    return empty
  } catch {
    return empty
  }
}

function getParsed(plan: TrainingPlan | null): ParsedTrainingPlan | null {
  if (!plan) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedTrainingPlan } | null
  return raw?.parsedPlan ?? null
}

function sessionKey(today: string): string {
  return `nexus-corpo-${today}`
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  today: string // YYYY-MM-DD
  initialPlans: TrainingPlan[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WorkoutTracker({ userId, today, initialPlans }: Props) {
  const toast = useToast()

  const [plans, setPlans] = useState<TrainingPlan[]>(initialPlans)
  const [planId, setPlanId] = useState<string | null>(null)
  const [sectionIdx, setSectionIdx] = useState(0)
  const [sectionTitle, setSectionTitle] = useState('')
  const [saves, setSaves] = useState<Record<string, ExerciseSave>>({})
  const [prevSaves, setPrevSaves] = useState<Record<string, ExerciseSave>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importReview, setImportReview] = useState<{
    result: FileImportResult
    parsed: ParsedTrainingPlan
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [extras, setExtras] = useState<TrainingExercisePlan[]>([])
  const [addingExtra, setAddingExtra] = useState(false)
  const [newExtraName, setNewExtraName] = useState('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── On mount: restore from sessionStorage (sem abrir modal automaticamente) ──
  // O seletor de treino só abre por ação explícita do utilizador (botão
  // "Escolher treino"/"Trocar"), para uma experiência mais fluida e menos invasiva.

  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey(today))
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          planId: string
          sectionIdx: number
          sectionTitle: string
        }
        setPlanId(parsed.planId)
        setSectionIdx(parsed.sectionIdx)
        setSectionTitle(parsed.sectionTitle)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load entry + prev entry when planId changes ──────────────────────────────

  useEffect(() => {
    if (!planId) return
    let cancelled = false

    async function loadEntries() {
      if (!planId) return
      const [entries, prev] = await Promise.all([
        getTrainingEntries(userId, today),
        getPrevTrainingEntry(userId, planId, today),
      ])

      if (cancelled) return

      const entry = (entries as Array<{ training_plan_id: string; notes: string | null }>).find(
        e => e.training_plan_id === planId
      )
      const notesV2 = parseNotes(entry?.notes ?? null)
      setSaves(notesV2.exercises)

      const prevEntry = prev as { notes: string | null } | null
      const prevNotes = parseNotes(prevEntry?.notes ?? null)
      setPrevSaves(prevNotes.exercises)
    }

    loadEntries()
    return () => {
      cancelled = true
    }
  }, [planId, userId, today])

  // ── Section selection ────────────────────────────────────────────────────────

  function selectSection(pid: string, si: number, st: string) {
    setPlanId(pid)
    setSectionIdx(si)
    setSectionTitle(st)
    setShowSelector(false)
    sessionStorage.setItem(sessionKey(today), JSON.stringify({ planId: pid, sectionIdx: si, sectionTitle: st }))
  }

  // ── Auto-save (debounced) ────────────────────────────────────────────────────

  const persistEntry = useCallback(
    async (newSaves: Record<string, ExerciseSave>, si: number) => {
      if (!planId) return
      const doneCount = Object.values(newSaves).filter(s => s.done).length
      const notesV2: NotesV2 = { v: 2, sectionIdx: si, exercises: newSaves }
      setSaving(true)
      await upsertTrainingEntry({
        user_id: userId,
        training_plan_id: planId,
        date: today,
        completed: doneCount > 0,
        notes: JSON.stringify(notesV2),
      })
      setSaving(false)
    },
    [planId, userId, today]
  )

  function scheduleSave(newSaves: Record<string, ExerciseSave>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistEntry(newSaves, sectionIdx), 800)
  }

  // ── Exercise state helpers ───────────────────────────────────────────────────

  function getSave(id: string): ExerciseSave {
    if (saves[id]) return saves[id]
    if (prevSaves[id]) return { done: false, sets: prevSaves[id].sets }
    return defaultSave()
  }

  function toggleDone(id: string) {
    const current = getSave(id)
    const updated = { ...saves, [id]: { ...current, done: !current.done } }
    setSaves(updated)
    scheduleSave(updated)
  }

  function updateSet(
    id: string,
    setIdx: number,
    field: keyof ExerciseLoad,
    value: string
  ) {
    const current = getSave(id)
    const newSets = current.sets.map((s, i) =>
      i === setIdx ? { ...s, [field]: value } : s
    )
    const updated = { ...saves, [id]: { ...current, sets: newSets } }
    setSaves(updated)
    scheduleSave(updated)
  }

  function addSet(id: string) {
    const current = getSave(id)
    const last = current.sets[current.sets.length - 1] ?? emptyLoad()
    const newSets = [...current.sets, { ...last }]
    const updated = { ...saves, [id]: { ...current, sets: newSets } }
    setSaves(updated)
    scheduleSave(updated)
  }

  function removeSet(id: string) {
    const current = getSave(id)
    if (current.sets.length <= 1) return
    const newSets = current.sets.slice(0, -1)
    const updated = { ...saves, [id]: { ...current, sets: newSets } }
    setSaves(updated)
    scheduleSave(updated)
  }

  function collapseAndSave(id: string) {
    setExpandedId(null)
    const current = getSave(id)
    const hasWeight = current.sets.some(s => s.weight.trim() !== '' || s.reps.trim() !== '')
    let finalSave = current
    if (hasWeight && !current.done) {
      finalSave = { ...current, done: true }
      const updated = { ...saves, [id]: finalSave }
      setSaves(updated)
      persistEntry(updated, sectionIdx)
      return
    }
    persistEntry(saves, sectionIdx)
  }

  // ── Set summary label ────────────────────────────────────────────────────────

  function setLabel(save: ExerciseSave): string {
    const validSets = save.sets.filter(s => s.weight.trim() !== '' || s.reps.trim() !== '')
    if (validSets.length === 0) return ''
    const count = save.sets.length
    const allSame =
      save.sets.every(
        s => s.weight === save.sets[0].weight && s.reps === save.sets[0].reps
      )
    if (allSame) {
      const w = save.sets[0].weight
      const r = save.sets[0].reps
      if (w && r) return `${count}s · ${w}kg × ${r}`
      if (w) return `${count}s · ${w}kg`
      if (r) return `${count}s · × ${r}`
    }
    return `${count}s · variado`
  }

  // ── Import flow ──────────────────────────────────────────────────────────────

  async function handleImportConfirm(result: FileImportResult) {
    const parsed = parseTrainingImport(result)
    setImportReview({ result, parsed })
    setShowImport(false)
  }

  async function confirmImport(parsed: ParsedTrainingPlan) {
    const fileName =
      importReview?.result.meta.fileName ?? 'treino'
    const cleanFileName = fileName.replace(/\.[^.]+$/, '').trim()
    const title =
      cleanFileName || (parsed.summary ? parsed.summary.slice(0, 60) : 'Treino')

    await saveTrainingPlan({
      user_id: userId,
      title,
      source_type: importReview?.result.kind ?? 'pdf',
      source_file_name: fileName,
      summary: parsed.summary ?? null,
      raw_content: { parsedPlan: parsed },
    })

    const updated = await getTrainingPlans(userId)
    setPlans((updated as TrainingPlan[]) ?? [])
    setImportReview(null)
    toast.success('Plano importado!')
    setShowSelector(true)
  }

  async function handleDeletePlan(id: string) {
    await deleteTrainingPlan(id, userId)
    setPlans(prev => prev.filter(p => p.id !== id))
    if (planId === id) {
      setPlanId(null)
      setSectionIdx(0)
      setSectionTitle('')
      setSaves({})
      sessionStorage.removeItem(sessionKey(today))
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const currentPlan = plans.find(p => p.id === planId) ?? null
  const parsedPlan = getParsed(currentPlan)
  const currentSection = parsedPlan?.sections[sectionIdx] ?? null
  const exercises = currentSection?.exercises ?? []
  const doneCount = exercises.filter(e => saves[e.id]?.done).length
  const totalCount = exercises.length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── No plan selected ──────────────────────────────────────────────── */}
      {!planId && (
        <EmptyState
          icon="dumbbell"
          title={plans.length === 0 ? 'Adicione um plano de treino' : 'Escolha o treino de hoje'}
          body={
            plans.length === 0
              ? 'Adicione um plano de treino para acompanhar sua evolução semana a semana.'
              : 'Selecione uma sessão do seu plano para registrar séries, cargas e progresso.'
          }
          action={{
            label: plans.length === 0 ? 'Importar plano' : 'Escolher treino',
            onClick: () => (plans.length > 0 ? setShowSelector(true) : setShowImport(true)),
          }}
        />
      )}

      {/* ── Plan selected ─────────────────────────────────────────────────── */}
      {planId && currentPlan && (
        <>
          {/* Header card */}
          <div
            style={{
              background: 'var(--bg1)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 11,
                  color: 'var(--text3)',
                  margin: '0 0 2px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {currentPlan.title}
              </p>
              <p
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--text1)',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {sectionTitle}
              </p>
            </div>
            <button
              onClick={() => setShowSelector(true)}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 12,
                color: 'var(--text2)',
                cursor: 'pointer',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              Trocar
            </button>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                    color: 'var(--text3)',
                  }}
                >
                  {doneCount}/{totalCount} exercicios
                </span>
                {saving && (
                  <span
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 11,
                      color: 'var(--text3)',
                    }}
                  >
                    A guardar...
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--bg2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
                    background: 'var(--teal)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Exercise list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map(ex => {
              const save = getSave(ex.id)
              const isExpanded = expandedId === ex.id
              const label = setLabel(save)

              return (
                <div
                  key={ex.id}
                  style={{
                    background: 'var(--bg1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {/* Collapsed row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleDone(ex.id)}
                      aria-label={save.done ? 'Marcar como nao feito' : 'Marcar como feito'}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: save.done ? 'none' : '2px solid var(--border)',
                        background: save.done ? 'var(--teal)' : 'transparent',
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
                      {save.done ? '✓' : ''}
                    </button>

                    {/* Name + summary */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: 'DM Sans, sans-serif',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text1)',
                          margin: 0,
                          textDecoration: save.done ? 'line-through' : 'none',
                          opacity: save.done ? 0.6 : 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ex.name}
                      </p>
                      {label ? (
                        <p
                          style={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 11,
                            color: 'var(--teal)',
                            margin: '2px 0 0',
                          }}
                        >
                          {label}
                        </p>
                      ) : ex.detail ? (
                        <p
                          style={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 11,
                            color: 'var(--text3)',
                            margin: '2px 0 0',
                          }}
                        >
                          {ex.detail}
                        </p>
                      ) : null}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                      aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text2)',
                        fontSize: 16,
                        padding: 4,
                        flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      ▾
                    </button>
                  </div>

                  {/* Expanded sets area */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: '1px solid var(--border)',
                        padding: '12px 14px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {save.sets.map((s, si) => (
                        <div
                          key={si}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 12,
                              color: 'var(--text3)',
                              width: 52,
                              flexShrink: 0,
                            }}
                          >
                            Serie {si + 1}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={s.weight}
                            onChange={e => updateSet(ex.id, si, 'weight', e.target.value)}
                            placeholder="0"
                            style={{
                              width: 56,
                              height: 34,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--bg2)',
                              color: 'var(--text1)',
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 14,
                              textAlign: 'center',
                              outline: 'none',
                              padding: '0 4px',
                            }}
                          />
                          <span
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 12,
                              color: 'var(--text3)',
                            }}
                          >
                            kg x
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={s.reps}
                            onChange={e => updateSet(ex.id, si, 'reps', e.target.value)}
                            placeholder="0"
                            style={{
                              width: 48,
                              height: 34,
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              background: 'var(--bg2)',
                              color: 'var(--text1)',
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 14,
                              textAlign: 'center',
                              outline: 'none',
                              padding: '0 4px',
                            }}
                          />
                        </div>
                      ))}

                      {/* Set controls */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 4,
                          alignItems: 'center',
                        }}
                      >
                        <button
                          onClick={() => addSet(ex.id)}
                          style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 12,
                            color: 'var(--text2)',
                            cursor: 'pointer',
                          }}
                        >
                          + Serie
                        </button>
                        <button
                          onClick={() => removeSet(ex.id)}
                          disabled={save.sets.length <= 1}
                          style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 12,
                            color: save.sets.length <= 1 ? 'var(--text3)' : 'var(--text2)',
                            cursor: save.sets.length <= 1 ? 'not-allowed' : 'pointer',
                            opacity: save.sets.length <= 1 ? 0.5 : 1,
                          }}
                        >
                          - Serie
                        </button>
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => collapseAndSave(ex.id)}
                          style={{
                            background: 'var(--gold)',
                            border: 'none',
                            borderRadius: 8,
                            padding: '7px 16px',
                            fontFamily: 'Syne, sans-serif',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#111',
                            cursor: 'pointer',
                          }}
                        >
                          Guardar ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Extra exercises added at runtime */}
            {extras.map(ex => {
              const save = getSave(ex.id)
              const isExpanded = expandedId === ex.id
              const label = setLabel(save)
              return (
                <div
                  key={ex.id}
                  style={{
                    background: 'var(--bg1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                    <button
                      onClick={() => toggleDone(ex.id)}
                      aria-label={save.done ? 'Marcar como nao feito' : 'Marcar como feito'}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: save.done ? 'none' : '2px solid var(--border)',
                        background: save.done ? 'var(--teal)' : 'transparent',
                        cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 13, fontWeight: 700, padding: 0,
                      }}
                    >
                      {save.done ? '✓' : ''}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
                        color: 'var(--text1)', margin: 0,
                        textDecoration: save.done ? 'line-through' : 'none',
                        opacity: save.done ? 0.6 : 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ex.name}
                      </p>
                      {label && (
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--teal)', margin: '2px 0 0' }}>
                          {label}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setExtras(prev => prev.filter(e => e.id !== ex.id))}
                      aria-label="Remover exercício"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: 4, flexShrink: 0 }}
                    >
                      ×
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                      aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text2)', fontSize: 16, padding: 4, flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      ▾
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {save.sets.map((s, si) => (
                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text3)', width: 52, flexShrink: 0 }}>
                            Serie {si + 1}
                          </span>
                          <input type="number" inputMode="decimal" value={s.weight}
                            onChange={e => updateSet(ex.id, si, 'weight', e.target.value)}
                            placeholder="0"
                            style={{ width: 56, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, textAlign: 'center', outline: 'none', padding: '0 4px' }}
                          />
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text3)' }}>kg x</span>
                          <input type="number" inputMode="numeric" value={s.reps}
                            onChange={e => updateSet(ex.id, si, 'reps', e.target.value)}
                            placeholder="0"
                            style={{ width: 48, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, textAlign: 'center', outline: 'none', padding: '0 4px' }}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <button onClick={() => addSet(ex.id)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                          + Serie
                        </button>
                        <button onClick={() => removeSet(ex.id)} disabled={save.sets.length <= 1} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: save.sets.length <= 1 ? 'var(--text3)' : 'var(--text2)', cursor: save.sets.length <= 1 ? 'not-allowed' : 'pointer', opacity: save.sets.length <= 1 ? 0.5 : 1 }}>
                          - Serie
                        </button>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => collapseAndSave(ex.id)} style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '7px 16px', fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#111', cursor: 'pointer' }}>
                          Guardar ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add extra exercise */}
            {addingExtra ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome do exercício"
                  value={newExtraName}
                  onChange={e => setNewExtraName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newExtraName.trim()) {
                      setExtras(prev => [...prev, { id: 'extra-' + Date.now(), name: newExtraName.trim() }])
                      setNewExtraName('')
                      setAddingExtra(false)
                    }
                    if (e.key === 'Escape') { setAddingExtra(false); setNewExtraName('') }
                  }}
                  style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, padding: '8px 12px', outline: 'none' }}
                />
                <button
                  onClick={() => {
                    if (newExtraName.trim()) {
                      setExtras(prev => [...prev, { id: 'extra-' + Date.now(), name: newExtraName.trim() }])
                      setNewExtraName('')
                      setAddingExtra(false)
                    }
                  }}
                  style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#111', cursor: 'pointer' }}
                >
                  OK
                </button>
                <button
                  onClick={() => { setAddingExtra(false); setNewExtraName('') }}
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text3)', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingExtra(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', padding: '10px',
                  background: 'transparent', border: '1.5px dashed var(--border)',
                  borderRadius: 12, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text3)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                + Adicionar exercício
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Plan history section ──────────────────────────────────────────── */}
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
            Planos Importados
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
                    color: plan.id === planId ? 'var(--teal)' : 'var(--text2)',
                    margin: 0,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: plan.id === planId ? 600 : 400,
                  }}
                >
                  {plan.title}
                </p>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  aria-label="Remover plano"
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
          minHeight: 44,
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text2)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          width: '100%',
          touchAction: 'manipulation',
        }}
      >
        <Icon name="plus" size={18} color="var(--teal)" />
        Importar plano de treino
      </button>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {showSelector && (
        <PlanSelector
          plans={plans}
          onSelect={selectSection}
          onClose={() => setShowSelector(false)}
          onImport={() => {
            setShowSelector(false)
            setShowImport(true)
          }}
        />
      )}

      <FileImportModal
        open={showImport}
        title="Importar plano de treino"
        kind="mixed"
        domain="training"
        onClose={() => setShowImport(false)}
        onConfirm={handleImportConfirm}
      />

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
