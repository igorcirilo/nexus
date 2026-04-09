'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import { useToast } from '@/components/Toast'
import {
  supabase,
  getDietPlans,
  getTrainingPlans,
  saveDietPlan,
  saveTrainingPlan,
} from '@/lib/supabase'
import {
  getDietMeals,
  getTrainingEntries,
  upsertDietMeal,
  upsertTrainingEntry,
} from '@/lib/body'
import {
  parseDietImport,
  parseTrainingImport,
  type ParsedDietPlan,
  type ParsedTrainingPlan,
} from '@/lib/body-plan'
import type {
  DietMeal,
  DietMealKey,
  DietPlan,
  FileImportResult,
  TrainingEntry,
  TrainingPlan,
} from '@/types'

type BodyTab = 'treino' | 'dieta'

const card: CSSProperties = {
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 16,
  padding: 14,
}

const mealOptions: Array<{ key: DietMealKey; label: string; icon: string }> = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoço', icon: '🍳' },
  { key: 'almoco', label: 'Almoço', icon: '🍽️' },
  { key: 'jantar', label: 'Jantar', icon: '🌙' },
  { key: 'lanche', label: 'Lanche', icon: '🥤' },
]

type ExerciseProgress = {
  checked: boolean
  load: string
  notes: string
}

type TrainingEntryNotesPayload = {
  freeText: string
  exercises?: Record<string, ExerciseProgress>
}

type DietMealNotesPayload = {
  freeText: string
  items?: Record<string, boolean>
}

function getImportSummary(result: FileImportResult) {
  if (result.kind === 'pdf') {
    return `PDF com ${result.pageCount} página(s)`
  }

  const totalRows = result.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0)
  return `${result.sheets.length} folha(s) · ${totalRows} linhas`
}

function getSourceLabel(sourceType: TrainingPlan['source_type'] | DietPlan['source_type']) {
  return sourceType === 'pdf' ? 'PDF' : 'Planilha'
}

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split('T')[0]
}

function asObject(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getImportResultFromRaw(raw: Record<string, unknown> | null): FileImportResult | null {
  if (!raw) return null

  if (
    raw.kind === 'pdf' &&
    typeof raw.pageCount === 'number' &&
    typeof raw.extractedText === 'string' &&
    Array.isArray(raw.pages)
  ) {
    return raw as unknown as FileImportResult
  }

  if (raw.kind === 'spreadsheet' && Array.isArray(raw.sheets)) {
    return raw as unknown as FileImportResult
  }

  return null
}

function parseTrainingEntryNotes(notes: string | null | undefined): TrainingEntryNotesPayload {
  if (!notes) return { freeText: '', exercises: {} }

  try {
    const parsed = JSON.parse(notes) as TrainingEntryNotesPayload
    if (parsed && typeof parsed === 'object') {
      return {
        freeText: typeof parsed.freeText === 'string' ? parsed.freeText : '',
        exercises: parsed.exercises ?? {},
      }
    }
  } catch {}

  return { freeText: notes, exercises: {} }
}

function stringifyTrainingEntryNotes(payload: TrainingEntryNotesPayload) {
  return JSON.stringify({
    freeText: payload.freeText,
    exercises: payload.exercises ?? {},
  })
}

function parseDietMealNotes(notes: string | null | undefined): DietMealNotesPayload {
  if (!notes) return { freeText: '', items: {} }

  try {
    const parsed = JSON.parse(notes) as DietMealNotesPayload
    if (parsed && typeof parsed === 'object') {
      return {
        freeText: typeof parsed.freeText === 'string' ? parsed.freeText : '',
        items: parsed.items ?? {},
      }
    }
  } catch {}

  return { freeText: notes, items: {} }
}

function stringifyDietMealNotes(payload: DietMealNotesPayload) {
  return JSON.stringify({
    freeText: payload.freeText,
    items: payload.items ?? {},
  })
}

function getParsedTrainingPlan(plan: TrainingPlan | null | undefined): ParsedTrainingPlan | null {
  const raw = asObject(plan?.raw_content)
  const parsed = asObject(raw?.parsedPlan)
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : null

  if (sections) {
    return {
      summary: typeof parsed?.summary === 'string' ? parsed.summary : plan?.summary ?? '',
      sections: sections as ParsedTrainingPlan['sections'],
    }
  }

  const importResult = getImportResultFromRaw(raw)
  return importResult ? parseTrainingImport(importResult) : null
}

function getParsedDietPlan(plan: DietPlan | null | undefined): ParsedDietPlan | null {
  const raw = asObject(plan?.raw_content)
  const parsed = asObject(raw?.parsedPlan)
  const meals = Array.isArray(parsed?.meals) ? parsed.meals : null

  if (meals) {
    return {
      summary: typeof parsed?.summary === 'string' ? parsed.summary : plan?.summary ?? '',
      meals: meals as ParsedDietPlan['meals'],
    }
  }

  const importResult = getImportResultFromRaw(raw)
  return importResult ? parseDietImport(importResult) : null
}

export default function CorpoPage() {
  const globalToast = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<BodyTab>('treino')
  const [loading, setLoading] = useState(true)
  const [showTrainingImport, setShowTrainingImport] = useState(false)
  const [showDietImport, setShowDietImport] = useState(false)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([])
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([])
  const [trainingEntries, setTrainingEntries] = useState<TrainingEntry[]>([])
  const [dietMeals, setDietMeals] = useState<DietMeal[]>([])
  const [selectedTrainingPlanId, setSelectedTrainingPlanId] = useState<string | null>(null)
  const [selectedDietPlanId, setSelectedDietPlanId] = useState<string | null>(null)
  const [trainingNotes, setTrainingNotes] = useState('')
  const [mealNotes, setMealNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [trainingReview, setTrainingReview] = useState<{ result: FileImportResult; parsed: ParsedTrainingPlan } | null>(null)
  const [dietReview,     setDietReview]     = useState<{ result: FileImportResult; parsed: ParsedDietPlan } | null>(null)

  const today = getLocalDateString()

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    if (type === 'error') globalToast.error(message)
    else globalToast.success(message)
  }

  async function loadBodyData(uid: string) {
    const [training, diet, entries, meals] = await Promise.all([
      getTrainingPlans(uid),
      getDietPlans(uid),
      getTrainingEntries(uid, today),
      getDietMeals(uid, today),
    ])

    const nextTrainingPlans = (training ?? []) as TrainingPlan[]
    const nextDietPlans = (diet ?? []) as DietPlan[]
    const nextEntries = (entries ?? []) as TrainingEntry[]
    const nextMeals = (meals ?? []) as DietMeal[]

    setTrainingPlans(nextTrainingPlans)
    setDietPlans(nextDietPlans)
    setTrainingEntries(nextEntries)
    setDietMeals(nextMeals)

    setSelectedTrainingPlanId((current) => current ?? nextTrainingPlans[0]?.id ?? null)
    setSelectedDietPlanId((current) => current ?? nextDietPlans[0]?.id ?? null)

    const effectiveTrainingPlanId = selectedTrainingPlanId ?? nextTrainingPlans[0]?.id
    const selectedEntry = nextEntries.find((entry) => entry.training_plan_id === effectiveTrainingPlanId)
    setTrainingNotes(parseTrainingEntryNotes(selectedEntry?.notes).freeText)

    const nextMealNotes: Record<string, string> = {}
    nextMeals.forEach((meal) => {
      nextMealNotes[meal.meal_key] = parseDietMealNotes(meal.notes).freeText
    })
    setMealNotes(nextMealNotes)
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/auth'
        return
      }

      if (!active) return

      setUserId(user.id)
      await loadBodyData(user.id)

      if (!active) return
      setLoading(false)
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [])

  const selectedTrainingEntry = useMemo(() => {
    if (!selectedTrainingPlanId) return null
    return trainingEntries.find((entry) => entry.training_plan_id === selectedTrainingPlanId) ?? null
  }, [selectedTrainingPlanId, trainingEntries])

  const selectedTrainingPlan = useMemo(() => {
    if (!selectedTrainingPlanId) return null
    return trainingPlans.find((plan) => plan.id === selectedTrainingPlanId) ?? null
  }, [selectedTrainingPlanId, trainingPlans])

  const selectedDietMeals = useMemo(() => {
    if (!selectedDietPlanId) return []
    return dietMeals.filter((meal) => meal.diet_plan_id === selectedDietPlanId)
  }, [selectedDietPlanId, dietMeals])

  const selectedDietPlan = useMemo(() => {
    if (!selectedDietPlanId) return null
    return dietPlans.find((plan) => plan.id === selectedDietPlanId) ?? null
  }, [selectedDietPlanId, dietPlans])

  useEffect(() => {
    if (trainingPlans.length === 0) {
      if (selectedTrainingPlanId !== null) setSelectedTrainingPlanId(null)
      return
    }

    if (!selectedTrainingPlanId || !trainingPlans.some((plan) => plan.id === selectedTrainingPlanId)) {
      setSelectedTrainingPlanId(trainingPlans[0].id)
    }
  }, [selectedTrainingPlanId, trainingPlans])

  useEffect(() => {
    if (dietPlans.length === 0) {
      if (selectedDietPlanId !== null) setSelectedDietPlanId(null)
      return
    }

    if (!selectedDietPlanId || !dietPlans.some((plan) => plan.id === selectedDietPlanId)) {
      setSelectedDietPlanId(dietPlans[0].id)
    }
  }, [selectedDietPlanId, dietPlans])

  useEffect(() => {
    setTrainingNotes(parseTrainingEntryNotes(selectedTrainingEntry?.notes).freeText)
  }, [selectedTrainingEntry])

  const parsedTrainingPlan = useMemo(
    () => getParsedTrainingPlan(selectedTrainingPlan),
    [selectedTrainingPlan]
  )

  const parsedDietPlan = useMemo(
    () => getParsedDietPlan(selectedDietPlan),
    [selectedDietPlan]
  )

  const trainingExerciseState = useMemo(
    () => parseTrainingEntryNotes(selectedTrainingEntry?.notes).exercises ?? {},
    [selectedTrainingEntry]
  )

  const trainingSummary = useMemo(() => {
    const latest = trainingPlans[0]
    const completedToday = trainingEntries.filter((entry) => entry.completed).length

    return {
      total: trainingPlans.length,
      latestTitle: latest?.title ?? 'Sem plano importado',
      latestDate: latest?.created_at
        ? format(new Date(latest.created_at), 'd MMM', { locale: pt })
        : '—',
      completedToday,
    }
  }, [trainingPlans, trainingEntries])

  const dietSummary = useMemo(() => {
    const latest = dietPlans[0]
    const doneMeals = dietMeals.filter((meal) => meal.completed).length

    return {
      total: dietPlans.length,
      latestTitle: latest?.title ?? 'Sem plano importado',
      latestDate: latest?.created_at
        ? format(new Date(latest.created_at), 'd MMM', { locale: pt })
        : '—',
      doneMeals,
    }
  }, [dietPlans, dietMeals])

  async function handleTrainingImport(result: FileImportResult) {
    if (!userId) return
    const parsedPlan = parseTrainingImport(result)
    setTrainingReview({ result, parsed: parsedPlan })
    setShowTrainingImport(false)
  }

  async function confirmTrainingImport(confirmed: ParsedTrainingPlan | ParsedDietPlan) {
    if (!userId || !trainingReview) return
    const parsedPlan = confirmed as ParsedTrainingPlan
    const summary = parsedPlan.summary || getImportSummary(trainingReview.result)

    const { error } = await saveTrainingPlan({
      user_id: userId,
      title: `Treino importado · ${trainingReview.result.meta.fileName}`,
      source_type: trainingReview.result.kind,
      source_file_name: trainingReview.result.meta.fileName,
      summary,
      raw_content: { ...trainingReview.result, parsedPlan },
    })

    if (error) { showToast('Erro ao guardar treino.', 'error'); return }
    setTrainingReview(null)
    await loadBodyData(userId)
    showToast('Plano de treino importado!')
  }

  async function handleDietImport(result: FileImportResult) {
    if (!userId) return
    const parsedPlan = parseDietImport(result)
    setDietReview({ result, parsed: parsedPlan })
    setShowDietImport(false)
  }

  async function confirmDietImport(confirmed: ParsedTrainingPlan | ParsedDietPlan) {
    if (!userId || !dietReview) return
    const parsedPlan = confirmed as ParsedDietPlan
    const summary = parsedPlan.summary || getImportSummary(dietReview.result)

    const { error } = await saveDietPlan({
      user_id: userId,
      title: `Dieta importada · ${dietReview.result.meta.fileName}`,
      source_type: dietReview.result.kind,
      source_file_name: dietReview.result.meta.fileName,
      summary,
      raw_content: { ...dietReview.result, parsedPlan },
    })

    if (error) { showToast('Erro ao guardar dieta.', 'error'); return }
    setDietReview(null)
    await loadBodyData(userId)
    showToast('Plano de dieta importado!')
  }

  async function persistTrainingEntry(
    next: TrainingEntryNotesPayload,
    completed = selectedTrainingEntry?.completed ?? false
  ) {
    if (!userId || !selectedTrainingPlanId) return new Error('missing training context')

    setSaving(true)

    const { error } = await upsertTrainingEntry({
      user_id: userId,
      training_plan_id: selectedTrainingPlanId,
      date: today,
      completed,
      notes: stringifyTrainingEntryNotes(next),
    })

    setSaving(false)
    return error
  }

  async function handleToggleTraining(completed: boolean) {
    const error = await persistTrainingEntry(
      {
        freeText: trainingNotes,
        exercises: trainingExerciseState,
      },
      completed
    )

    if (error) {
      showToast('Erro ao guardar treino do dia.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast(completed ? 'Treino marcado como feito.' : 'Treino desmarcado.')
  }

  async function handleSaveTrainingNotes() {
    const error = await persistTrainingEntry({
      freeText: trainingNotes,
      exercises: trainingExerciseState,
    })

    if (error) {
      showToast('Erro ao guardar notas do treino.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast('Notas do treino guardadas.')
  }

  async function handleExerciseToggle(exerciseId: string, checked: boolean) {
    const nextExercises = {
      ...trainingExerciseState,
      [exerciseId]: {
        checked,
        load: trainingExerciseState[exerciseId]?.load ?? '',
        notes: trainingExerciseState[exerciseId]?.notes ?? '',
      },
    }

    const error = await persistTrainingEntry(
      {
        freeText: trainingNotes,
        exercises: nextExercises,
      },
      checked || selectedTrainingEntry?.completed || false
    )

    if (error) {
      showToast('Erro ao guardar exercicio.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast(checked ? 'Exercicio concluido.' : 'Exercicio desmarcado.')
  }

  async function handleExerciseFieldSave(exerciseId: string, field: 'load' | 'notes', value: string) {
    const nextExercises = {
      ...trainingExerciseState,
      [exerciseId]: {
        checked: trainingExerciseState[exerciseId]?.checked ?? false,
        load: field === 'load' ? value : trainingExerciseState[exerciseId]?.load ?? '',
        notes: field === 'notes' ? value : trainingExerciseState[exerciseId]?.notes ?? '',
      },
    }

    const error = await persistTrainingEntry({
      freeText: trainingNotes,
      exercises: nextExercises,
    })

    if (error) {
      showToast('Erro ao guardar detalhe do exercicio.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast('Detalhe do exercicio guardado.')
  }

  async function persistDietMeal(
    mealKey: DietMealKey,
    next: DietMealNotesPayload,
    completed: boolean
  ) {
    if (!userId || !selectedDietPlanId) return new Error('missing diet context')

    setSaving(true)

    const { error } = await upsertDietMeal({
      user_id: userId,
      diet_plan_id: selectedDietPlanId,
      date: today,
      meal_key: mealKey,
      completed,
      notes: stringifyDietMealNotes(next),
    })

    setSaving(false)
    return error
  }

  async function handleToggleMeal(mealKey: DietMealKey, completed: boolean) {
    const current = selectedDietMeals.find((meal) => meal.meal_key === mealKey)
    const parsed = parseDietMealNotes(current?.notes)
    const error = await persistDietMeal(
      mealKey,
      {
        freeText: mealNotes[mealKey] ?? '',
        items: parsed.items ?? {},
      },
      completed
    )

    if (error) {
      showToast('Erro ao guardar refeição.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast(completed ? 'Refeição marcada.' : 'Refeição desmarcada.')
  }

  async function handleSaveMealNotes(mealKey: DietMealKey) {
    if (!userId || !selectedDietPlanId) return

    const current = selectedDietMeals.find((meal) => meal.meal_key === mealKey)
    const parsed = parseDietMealNotes(current?.notes)
    const error = await persistDietMeal(
      mealKey,
      {
        freeText: mealNotes[mealKey] ?? '',
        items: parsed.items ?? {},
      },
      current?.completed ?? false
    )

    if (error) {
      showToast('Erro ao guardar nota da refeição.', 'error')
      return
    }

    await loadBodyData(userId)
    showToast('Nota da refeição guardada.')
  }

  async function handleMealItemToggle(mealKey: DietMealKey, itemLabel: string, checked: boolean) {
    const current = selectedDietMeals.find((meal) => meal.meal_key === mealKey)
    const parsed = parseDietMealNotes(current?.notes)
    const nextItems = {
      ...(parsed.items ?? {}),
      [itemLabel]: checked,
    }

    const error = await persistDietMeal(
      mealKey,
      {
        freeText: mealNotes[mealKey] ?? '',
        items: nextItems,
      },
      current?.completed ?? checked
    )

    if (error) {
      showToast('Erro ao guardar item da refeicao.', 'error')
      return
    }

    await loadBodyData(userId!)
    showToast(checked ? 'Item marcado.' : 'Item desmarcado.')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text3)' }}>
          a carregar…
        </div>
      </div>
    )
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
          Corpo
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>
          Treino e dieta com acompanhamento diário simples e persistente.
        </p>
      </div>

      <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Treino de hoje</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--teal)' }}>
            {trainingSummary.completedToday > 0 ? 'Feito' : 'Pendente'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {trainingSummary.latestTitle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Última importação: {trainingSummary.latestDate}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Dieta de hoje</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>
            {dietSummary.doneMeals}/4
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {dietSummary.latestTitle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Última importação: {dietSummary.latestDate}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          background: 'var(--bg2)',
          borderRadius: 14,
          padding: 4,
          gap: 3,
          margin: '14px 20px 0',
          border: '0.5px solid var(--border)',
        }}
      >
        {[
          { key: 'treino' as BodyTab, label: 'Treino', icon: '🏋️' },
          { key: 'dieta' as BodyTab, label: 'Dieta', icon: '🥗' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              background: tab === item.key ? 'var(--bg1)' : 'transparent',
              color: tab === item.key ? 'var(--gold)' : 'var(--text3)',
              fontFamily: 'Syne, sans-serif',
              fontWeight: tab === item.key ? 700 : 500,
              fontSize: 12,
            }}
          >
            <span style={{ marginRight: 6 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'treino' && (
        <section style={{ padding: '14px 20px 0', display: 'grid', gap: 12 }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>
                Treino de hoje
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Marca o treino como feito e guarda notas rápidas.
              </div>
            </div>
            <button
              onClick={() => setShowTrainingImport(true)}
              style={{
                background: 'var(--gold)',
                color: 'var(--bg0)',
                border: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Importar
            </button>
          </div>

          {trainingPlans.length === 0 ? (
            <div style={card}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Ainda não tens planos de treino importados.
              </div>
            </div>
          ) : (
            <>
              <div style={card}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Plano ativo de hoje
                </label>
                <select
                  value={selectedTrainingPlanId ?? ''}
                  onChange={(e) => setSelectedTrainingPlanId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg1)',
                    color: 'var(--text1)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    outline: 'none',
                  }}
                >
                  {trainingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => handleToggleTraining(true)}
                    disabled={saving || !selectedTrainingPlanId}
                    style={{
                      flex: 1,
                      background: selectedTrainingEntry?.completed ? 'rgba(30,203,180,.14)' : 'var(--teal)',
                      color: selectedTrainingEntry?.completed ? 'var(--teal)' : '#04110F',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {selectedTrainingEntry?.completed ? 'Treino feito ✓' : 'Marcar como feito'}
                  </button>

                  <button
                    onClick={() => handleToggleTraining(false)}
                    disabled={saving || !selectedTrainingPlanId}
                    style={{
                      background: 'transparent',
                      color: 'var(--text3)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    Limpar
                  </button>
                </div>

                {parsedTrainingPlan && parsedTrainingPlan.sections.length > 0 && (
                  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {parsedTrainingPlan.sections.map((section) => (
                      <div
                        key={section.id}
                        style={{
                          background: 'var(--bg1)',
                          border: '0.5px solid var(--border)',
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
                          {section.title}
                        </div>
                        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                          {section.exercises.map((exercise) => {
                            const progress = trainingExerciseState[exercise.id] ?? {
                              checked: false,
                              load: '',
                              notes: '',
                            }

                            return (
                              <div
                                key={exercise.id}
                                style={{
                                  border: '0.5px solid var(--border)',
                                  borderRadius: 12,
                                  padding: 10,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>
                                      {exercise.name}
                                    </div>
                                    {exercise.detail && (
                                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                                        {exercise.detail}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleExerciseToggle(exercise.id, !progress.checked)}
                                    disabled={saving}
                                    style={{
                                      background: progress.checked ? 'rgba(30,203,180,.14)' : 'transparent',
                                      color: progress.checked ? 'var(--teal)' : 'var(--text3)',
                                      border: '0.5px solid var(--border)',
                                      borderRadius: 10,
                                      padding: '8px 10px',
                                      fontFamily: 'Syne, sans-serif',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {progress.checked ? 'Feito' : 'Check'}
                                  </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, marginTop: 10 }}>
                                  <input
                                    value={progress.load}
                                    onChange={(e) =>
                                      handleExerciseFieldSave(exercise.id, 'load', e.target.value)
                                    }
                                    placeholder="Carga"
                                    style={{
                                      background: 'transparent',
                                      color: 'var(--text1)',
                                      border: '0.5px solid var(--border)',
                                      borderRadius: 10,
                                      padding: '10px 12px',
                                      outline: 'none',
                                    }}
                                  />
                                  <input
                                    value={progress.notes}
                                    onChange={(e) =>
                                      handleExerciseFieldSave(exercise.id, 'notes', e.target.value)
                                    }
                                    placeholder="Observação rápida"
                                    style={{
                                      background: 'transparent',
                                      color: 'var(--text1)',
                                      border: '0.5px solid var(--border)',
                                      borderRadius: 10,
                                      padding: '10px 12px',
                                      outline: 'none',
                                    }}
                                  />
                                  <div style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>
                                    {progress.checked ? 'ok' : 'pendente'}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTrainingPlan && (!parsedTrainingPlan || parsedTrainingPlan.sections.length === 0) && (
                  <div
                    style={{
                      marginTop: 12,
                      background: 'var(--bg1)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                      fontSize: 12,
                      color: 'var(--text3)',
                    }}
                  >
                    Este plano ainda não gerou exercícios utilizáveis. Se foi importado antes desta fase, tenta
                    reimportar esse ficheiro para o tratamento ficar completo.
                  </div>
                )}

                <textarea
                  value={trainingNotes}
                  onChange={(e) => setTrainingNotes(e.target.value)}
                  placeholder="Notas do treino: carga, energia, observações..."
                  style={{
                    width: '100%',
                    minHeight: 96,
                    resize: 'vertical',
                    marginTop: 12,
                    background: 'var(--bg1)',
                    color: 'var(--text1)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    outline: 'none',
                  }}
                />

                <button
                  onClick={handleSaveTrainingNotes}
                  disabled={saving || !selectedTrainingPlanId}
                  style={{
                    width: '100%',
                    marginTop: 10,
                    background: 'var(--bg1)',
                    color: 'var(--gold)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  Guardar notas
                </button>
              </div>

              {trainingPlans.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    ...card,
                    border:
                      selectedTrainingPlanId === plan.id
                        ? '0.5px solid rgba(30,203,180,.45)'
                        : '0.5px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>
                        {plan.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        {plan.summary ?? 'Sem resumo'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {format(new Date(plan.created_at), 'd MMM yyyy', { locale: pt })}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                    Ficheiro: {plan.source_file_name ?? '—'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Origem: {getSourceLabel(plan.source_type)}
                  </div>
                  <button
                    onClick={() => setSelectedTrainingPlanId(plan.id)}
                    style={{
                      marginTop: 10,
                      background: selectedTrainingPlanId === plan.id ? 'rgba(30,203,180,.14)' : 'transparent',
                      color: selectedTrainingPlanId === plan.id ? 'var(--teal)' : 'var(--gold)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedTrainingPlanId === plan.id ? 'Plano ativo' : 'Abrir plano'}
                  </button>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {tab === 'dieta' && (
        <section style={{ padding: '14px 20px 0', display: 'grid', gap: 12 }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>
                Dieta de hoje
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Marca refeições concluídas e guarda observações rápidas.
              </div>
            </div>
            <button
              onClick={() => setShowDietImport(true)}
              style={{
                background: 'var(--gold)',
                color: 'var(--bg0)',
                border: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Importar
            </button>
          </div>

          {dietPlans.length === 0 ? (
            <div style={card}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Ainda não tens planos de dieta importados.
              </div>
            </div>
          ) : (
            <>
              <div style={card}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Plano ativo de hoje
                </label>
                <select
                  value={selectedDietPlanId ?? ''}
                  onChange={(e) => setSelectedDietPlanId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg1)',
                    color: 'var(--text1)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    outline: 'none',
                  }}
                >
                  {dietPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  {mealOptions.map((meal) => {
                    const current = selectedDietMeals.find((item) => item.meal_key === meal.key)
                    const checked = current?.completed ?? false
                    const parsed = parseDietMealNotes(current?.notes)
                    const mealPlan = parsedDietPlan?.meals.find((item) => item.key === meal.key)

                    return (
                      <div
                        key={meal.key}
                        style={{
                          background: 'var(--bg1)',
                          border: '0.5px solid var(--border)',
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
                            {meal.icon} {meal.label}
                          </div>
                          <button
                            onClick={() => handleToggleMeal(meal.key, !checked)}
                            disabled={saving || !selectedDietPlanId}
                            style={{
                              background: checked ? 'rgba(30,203,180,.14)' : 'transparent',
                              color: checked ? 'var(--teal)' : 'var(--text3)',
                              border: '0.5px solid var(--border)',
                              borderRadius: 10,
                              padding: '8px 10px',
                              fontFamily: 'Syne, sans-serif',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {checked ? 'Feita ✓' : 'Marcar'}
                          </button>
                        </div>

                        {mealPlan && mealPlan.items.length > 0 && (
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {mealPlan.items.map((itemLabel) => {
                              const itemChecked = parsed.items?.[itemLabel] ?? false

                              return (
                                <button
                                  key={itemLabel}
                                  onClick={() => handleMealItemToggle(meal.key, itemLabel, !itemChecked)}
                                  disabled={saving || !selectedDietPlanId}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    alignItems: 'center',
                                    background: 'transparent',
                                    color: 'var(--text2)',
                                    border: '0.5px solid var(--border)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span style={{ textAlign: 'left' }}>{itemLabel}</span>
                                  <span style={{ color: itemChecked ? 'var(--teal)' : 'var(--text3)' }}>
                                    {itemChecked ? 'ok' : 'check'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        <textarea
                          value={mealNotes[meal.key] ?? ''}
                          onChange={(e) => setMealNotes((prev) => ({ ...prev, [meal.key]: e.target.value }))}
                          placeholder="Notas da refeição..."
                          style={{
                            width: '100%',
                            minHeight: 72,
                            resize: 'vertical',
                            marginTop: 10,
                            background: 'transparent',
                            color: 'var(--text1)',
                            border: '0.5px solid var(--border)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            outline: 'none',
                          }}
                        />

                        <button
                          onClick={() => handleSaveMealNotes(meal.key)}
                          disabled={saving || !selectedDietPlanId}
                          style={{
                            marginTop: 8,
                            background: 'transparent',
                            color: 'var(--gold)',
                            border: 'none',
                            padding: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Guardar nota
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {dietPlans.map((plan) => (
                <div key={plan.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>
                        {plan.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        {plan.summary ?? 'Sem resumo'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {format(new Date(plan.created_at), 'd MMM yyyy', { locale: pt })}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                    Ficheiro: {plan.source_file_name ?? '—'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Origem: {getSourceLabel(plan.source_type)}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      <FileImportModal
        open={showTrainingImport}
        title="Importar treino"
        kind="mixed"
        onClose={() => setShowTrainingImport(false)}
        onConfirm={handleTrainingImport}
        confirmLabel="Guardar treino"
      />

      <FileImportModal
        open={showDietImport}
        title="Importar dieta"
        kind="mixed"
        onClose={() => setShowDietImport(false)}
        onConfirm={handleDietImport}
        confirmLabel="Guardar dieta"
      />

      <Nav />

      {trainingReview && (
        <PlanReviewModal
          mode="training"
          plan={trainingReview.parsed}
          onConfirm={confirmTrainingImport}
          onCancel={() => setTrainingReview(null)}
        />
      )}
      {dietReview && (
        <PlanReviewModal
          mode="diet"
          plan={dietReview.parsed}
          onConfirm={confirmDietImport}
          onCancel={() => setDietReview(null)}
        />
      )}
    </main>
  )
}
