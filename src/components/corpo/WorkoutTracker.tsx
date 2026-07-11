'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import PlanSelector from '@/components/corpo/PlanSelector'
import EmptyState from '@/components/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/Toast'
import { getTrainingPlans, saveTrainingPlan } from '@/lib/supabase'
import {
  getTrainingEntries,
  getTrainingEntriesForRange,
  getPrevTrainingEntry,
  upsertTrainingEntry,
  deleteTrainingPlan,
} from '@/lib/body'
import { parseTrainingImport, type ParsedTrainingPlan, type TrainingExercisePlan } from '@/lib/body-plan'
import type { TrainingPlan, FileImportResult, TrainingEntry } from '@/types'
import { format, subDays } from 'date-fns'
import { parseLocalDate } from '@/lib/date'

// ── Internal Types ─────────────────────────────────────────────────────────────

type ExerciseLoad = { weight: string; reps: string }
type ExerciseSave = { done: boolean; sets: ExerciseLoad[] }
type NotesV2 = { v: 2; sectionIdx: number; exercises: Record<string, ExerciseSave>; extras?: TrainingExercisePlan[] }

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

// O título do plano vem do nome do ficheiro importado (ex.: "plano_treino_abc").
// Para exibição, troca separadores por espaços e capitaliza — sem alterar o
// valor guardado.
function prettyPlanName(title: string): string {
  return title
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Sugere a próxima sessão pela rotação: a seguir à última registada. Sem
// histórico, começa na primeira secção.
function nextRotationIdx(prevSectionIdx: number | null, sectionCount: number): number {
  if (sectionCount <= 0) return 0
  if (prevSectionIdx === null) return 0
  return (prevSectionIdx + 1) % sectionCount
}

// A seleção do treino do dia vive em localStorage (não sessionStorage):
// num PWA o app é fechado/reaberto no meio do treino e a escolha não pode
// se perder. A chave é diária; entradas antigas são limpas no BodyHub.
function readDaySelection(today: string): { planId: string; sectionIdx: number; sectionTitle: string } | null {
  try {
    const key = sessionKey(today)
    let stored = localStorage.getItem(key)
    if (!stored) {
      // Migração: seleções feitas antes desta mudança viviam em sessionStorage.
      stored = sessionStorage.getItem(key)
      if (stored) localStorage.setItem(key, stored)
    }
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [extras, setExtras] = useState<TrainingExercisePlan[]>([])
  const [addingExtra, setAddingExtra] = useState(false)
  const [newExtraName, setNewExtraName] = useState('')
  // Estado "ao abrir": sessão sugerida pela rotação + treinos concluídos nos
  // últimos 7 dias. Só é usado quando ainda não há sessão escolhida no dia.
  const [entryHint, setEntryHint] = useState<{ suggestIdx: number; weekCount: number } | null>(null)
  // Cronômetro de descanso: inicia ao concluir um exercício. Guarda o instante
  // de fim; um tick de 500ms atualiza a contagem exibida.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const REST_SECONDS = 90

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mantém os extras correntes acessíveis dentro de persistEntry sem os
  // colocar nas deps do callback (evita debounces obsoletos).
  const extrasRef = useRef<TrainingExercisePlan[]>([])
  // Evita re-gravar logo a seguir a restaurar os extras do servidor.
  const extrasHydrated = useRef(false)

  useEffect(() => {
    extrasRef.current = extras
  }, [extras])

  // ── On mount: restore from sessionStorage (sem abrir modal automaticamente) ──
  // O seletor de treino só abre por ação explícita do utilizador (botão
  // "Escolher treino"/"Trocar"), para uma experiência mais fluida e menos invasiva.

  useEffect(() => {
    const parsed = readDaySelection(today)
    if (parsed) {
      setPlanId(parsed.planId)
      setSectionIdx(parsed.sectionIdx)
      setSectionTitle(parsed.sectionTitle)
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
      const restoredExtras = notesV2.extras ?? []
      extrasRef.current = restoredExtras
      extrasHydrated.current = false
      setExtras(restoredExtras)

      const prevEntry = prev as { notes: string | null } | null
      const prevNotes = parseNotes(prevEntry?.notes ?? null)
      setPrevSaves(prevNotes.exercises)
    }

    loadEntries()
    return () => {
      cancelled = true
    }
  }, [planId, userId, today])

  // ── Entry state: rotation suggestion + weekly count ──────────────────────────
  // Corre quando ainda não há sessão escolhida hoje. O plano em foco é o
  // primeiro da lista (o mais recente); o utilizador pode trocar pelo seletor.
  const focusPlanId = plans[0]?.id ?? null
  useEffect(() => {
    if (planId || !focusPlanId) { setEntryHint(null); return }
    let cancelled = false
    async function loadHint() {
      if (!focusPlanId) return
      const weekAgo = format(subDays(parseLocalDate(today), 6), 'yyyy-MM-dd')
      const [prev, range] = await Promise.all([
        getPrevTrainingEntry(userId, focusPlanId, today),
        getTrainingEntriesForRange(userId, weekAgo, today),
      ])
      if (cancelled) return
      const focus = plans.find(p => p.id === focusPlanId) ?? null
      const sectionCount = getParsed(focus)?.sections.length ?? 0
      const prevNotes = parseNotes((prev as { notes: string | null } | null)?.notes ?? null)
      const prevIdx = (prev as { notes: string | null } | null) ? prevNotes.sectionIdx : null
      const weekDates = new Set((range as TrainingEntry[]).filter(e => e.completed).map(e => e.date))
      setEntryHint({ suggestIdx: nextRotationIdx(prevIdx, sectionCount), weekCount: weekDates.size })
    }
    loadHint()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, focusPlanId, userId, today])

  // ── Section selection ────────────────────────────────────────────────────────

  function selectSection(pid: string, si: number, st: string) {
    setPlanId(pid)
    setSectionIdx(si)
    setSectionTitle(st)
    setShowSelector(false)
    try {
      localStorage.setItem(sessionKey(today), JSON.stringify({ planId: pid, sectionIdx: si, sectionTitle: st }))
    } catch {
      // ignore
    }
  }

  // Volta ao estado "ao abrir" (visão geral das sessões). Só limpa o ponteiro
  // da sessão do dia no localStorage — o registo de hoje (séries/cargas) fica
  // guardado na BD e é recarregado ao voltar a entrar na sessão.
  function deselectSession() {
    setPlanId(null)
    setExpandedId(null)
    setRestEndsAt(null)
    setShowSelector(false)
    try {
      localStorage.removeItem(sessionKey(today))
    } catch {
      // ignore
    }
  }

  // ── Auto-save (debounced) ────────────────────────────────────────────────────

  const persistEntry = useCallback(
    async (newSaves: Record<string, ExerciseSave>, si: number) => {
      if (!planId) return
      const doneCount = Object.values(newSaves).filter(s => s.done).length
      // Persiste também os exercícios extra para sobreviverem ao reload (P2.3).
      const notesV2: NotesV2 = { v: 2, sectionIdx: si, exercises: newSaves, extras: extrasRef.current }
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

  // Persiste a lista de extras quando muda (adição/remoção). O guard de
  // hidratação evita uma gravação redundante logo após restaurar do servidor.
  useEffect(() => {
    if (!planId) return
    if (!extrasHydrated.current) {
      extrasHydrated.current = true
      return
    }
    persistEntry(saves, sectionIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras])

  // ── Exercise state helpers ───────────────────────────────────────────────────

  function getSave(id: string): ExerciseSave {
    if (saves[id]) return saves[id]
    if (prevSaves[id]) return { done: false, sets: prevSaves[id].sets }
    return defaultSave()
  }

  // Sem registro de hoje, os sets vêm da última sessão (memória). O usuário
  // precisa conseguir distinguir "já registrei hoje" de "sugestão da última vez".
  function isInherited(id: string): boolean {
    return !saves[id] && !!prevSaves[id]
  }

  function toggleDone(id: string) {
    const current = getSave(id)
    const willBeDone = !current.done
    const updated = { ...saves, [id]: { ...current, done: willBeDone } }
    setSaves(updated)
    scheduleSave(updated)
    // Ao concluir um exercício, arranca o descanso; ao desmarcar, limpa-o.
    setRestEndsAt(willBeDone ? Date.now() + REST_SECONDS * 1000 : null)
  }

  // Tick do cronômetro de descanso (só corre enquanto activo).
  useEffect(() => {
    if (restEndsAt === null) return
    const id = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(id)
  }, [restEndsAt])

  const restRemaining = restEndsAt ? Math.max(0, Math.round((restEndsAt - nowTs) / 1000)) : 0
  useEffect(() => {
    if (restEndsAt !== null && restRemaining === 0) setRestEndsAt(null)
  }, [restEndsAt, restRemaining])

  // Sugestão de progressão de carga: se na última sessão todas as séries foram
  // à mesma carga (numérica, com reps), propõe +2,5 kg. Deriva só do que foi
  // realmente registado — não inventa.
  function progressionHint(id: string): string | null {
    const prev = prevSaves[id]
    if (!prev || prev.sets.length === 0) return null
    const first = prev.sets[0]
    const w = parseFloat((first.weight || '').replace(',', '.'))
    if (!Number.isFinite(w) || w <= 0) return null
    const allSame = prev.sets.every(s => s.weight === first.weight && (s.reps?.trim() ?? '') !== '')
    if (!allSame) return null
    const next = w + 2.5
    return `+2,5 kg → ${String(next).replace('.', ',')} kg`
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
      try {
        localStorage.removeItem(sessionKey(today))
        sessionStorage.removeItem(sessionKey(today))
      } catch {
        // ignore
      }
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const currentPlan = plans.find(p => p.id === planId) ?? null
  const parsedPlan = getParsed(currentPlan)
  const currentSection = parsedPlan?.sections[sectionIdx] ?? null
  const exercises = currentSection?.exercises ?? []

  // Plano em foco no estado "ao abrir" (sem sessão escolhida): o primeiro da
  // lista. As suas secções alimentam a sugestão e a lista de sessões.
  const focusPlan = plans[0] ?? null
  const focusSections = getParsed(focusPlan)?.sections ?? []
  const suggestIdx = Math.min(entryHint?.suggestIdx ?? 0, Math.max(0, focusSections.length - 1))
  // Conta plano + extras em ambos os lados (barra e persistência) — P2.3.
  const doneCount =
    exercises.filter(e => saves[e.id]?.done).length +
    extras.filter(e => saves[e.id]?.done).length
  const totalCount = exercises.length + extras.length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Sem plano nenhum: importar ────────────────────────────────────── */}
      {!planId && plans.length === 0 && (
        <EmptyState
          icon="dumbbell"
          title="Adicione um plano de treino"
          body="Adicione um plano de treino para acompanhar sua evolução semana a semana."
          action={{ label: 'Importar plano', onClick: () => setShowImport(true) }}
        />
      )}

      {/* ── Há plano mas nenhuma sessão escolhida hoje: "ao abrir" ─────────── */}
      {!planId && plans.length > 0 && focusPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Cabeçalho do plano */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text3)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Plano de treino
              </p>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text1)', margin: 0, lineHeight: 1.2 }}>
                {prettyPlanName(focusPlan.title)}
              </p>
            </div>
            <button
              onClick={() => setShowSelector(true)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
            >
              Trocar plano
            </button>
          </div>

          {/* Card da sessão sugerida (rotação) */}
          {focusSections[suggestIdx] && (
            <div style={{ background: 'var(--bg1)', border: '1px solid rgba(232,168,56,.30)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gold)', background: 'rgba(232,168,56,.13)', borderRadius: 100, padding: '4px 10px' }}>
                  Sugerido para hoje
                </span>
                {entryHint && entryHint.weekCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    🔥 {entryHint.weekCount} {entryHint.weekCount === 1 ? 'treino' : 'treinos'} · 7d
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(232,168,56,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 19 }}>💪</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--text1)', margin: 0, lineHeight: 1.25 }}>
                    {focusSections[suggestIdx].title}
                  </p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>
                    {focusSections[suggestIdx].exercises.length} exercícios
                  </p>
                </div>
              </div>
              {entryHint && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🧭</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text1)', lineHeight: 1.45 }}>
                    {entryHint.weekCount === 0
                      ? 'Primeira sessão da semana — bora abrir bem.'
                      : `Boa constância: ${entryHint.weekCount} ${entryHint.weekCount === 1 ? 'treino' : 'treinos'} em 7 dias. Segue a rotação.`}
                  </span>
                </div>
              )}
              <button
                onClick={() => selectSection(focusPlan.id, suggestIdx, focusSections[suggestIdx].title)}
                style={{ width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none', borderRadius: 13, padding: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Começar {focusSections[suggestIdx].title}
              </button>
            </div>
          )}

          {/* Outras sessões do plano */}
          {focusSections.length > 1 && (
            <div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text3)', margin: '4px 2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Outras sessões
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {focusSections.map((s, i) =>
                  i === suggestIdx ? null : (
                    <button
                      key={i}
                      onClick={() => selectSection(focusPlan.id, i, s.title)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13.5, fontWeight: 600, color: 'var(--text1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title}
                        </p>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>
                          {s.exercises.length} exercícios
                        </p>
                      </div>
                      <span style={{ color: 'var(--text3)', fontSize: 18, flexShrink: 0 }}>›</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <button
                onClick={deselectSession}
                aria-label="Voltar às sessões"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ‹
              </button>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 11,
                    color: 'var(--text3)',
                    margin: '0 0 2px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {prettyPlanName(currentPlan.title)}
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
                  {doneCount}/{totalCount} exercícios
                </span>
                {saving && (
                  <span
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 11,
                      color: 'var(--text3)',
                    }}
                  >
                    Salvando...
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

          {/* Cronômetro de descanso */}
          {restEndsAt !== null && restRemaining > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(30,203,180,.10)', border: '1px solid rgba(30,203,180,.3)', borderRadius: 100, padding: '9px 12px' }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--teal)' }}>
                ⏱ Descanso · {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
              </span>
              <button
                onClick={() => setRestEndsAt(prev => (prev ?? Date.now()) + 30000)}
                style={{ background: 'rgba(30,203,180,.14)', border: 'none', borderRadius: 8, padding: '4px 10px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--teal)', cursor: 'pointer' }}
              >
                +30s
              </button>
              <button
                onClick={() => setRestEndsAt(null)}
                aria-label="Encerrar descanso"
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Exercise list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map(ex => {
              const save = getSave(ex.id)
              const isExpanded = expandedId === ex.id
              const label = setLabel(save)
              const inherited = isInherited(ex.id)

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
                      aria-label={save.done ? 'Marcar como não feito' : 'Marcar como feito'}
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
                        color: 'var(--on-accent)',
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
                            color: inherited ? 'var(--text3)' : 'var(--teal)',
                            fontStyle: inherited ? 'italic' : 'normal',
                            margin: '2px 0 0',
                          }}
                        >
                          {inherited ? `última sessão · ${label}` : label}
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
                      {inherited && (
                        <p
                          style={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 11,
                            color: 'var(--text3)',
                            fontStyle: 'italic',
                            margin: 0,
                          }}
                        >
                          Valores da última sessão — edite ou toque em Salvar para registrar hoje.
                        </p>
                      )}
                      {!save.done && progressionHint(ex.id) && (
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, background: 'rgba(127,119,221,.14)', borderRadius: 100, padding: '4px 10px' }}>
                          <span style={{ fontSize: 12 }}>🧭</span>
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>
                            {progressionHint(ex.id)}
                          </span>
                        </div>
                      )}
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
                            Série {si + 1}
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
                          + Série
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
                          - Série
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
                          Salvar ✓
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
              const inherited = isInherited(ex.id)
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
                      aria-label={save.done ? 'Marcar como não feito' : 'Marcar como feito'}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: save.done ? 'none' : '2px solid var(--border)',
                        background: save.done ? 'var(--teal)' : 'transparent',
                        cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--on-accent)', fontSize: 13, fontWeight: 700, padding: 0,
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
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: inherited ? 'var(--text3)' : 'var(--teal)', fontStyle: inherited ? 'italic' : 'normal', margin: '2px 0 0' }}>
                          {inherited ? `última sessão · ${label}` : label}
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
                            Série {si + 1}
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
                          + Série
                        </button>
                        <button onClick={() => removeSet(ex.id)} disabled={save.sets.length <= 1} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: save.sets.length <= 1 ? 'var(--text3)' : 'var(--text2)', cursor: save.sets.length <= 1 ? 'not-allowed' : 'pointer', opacity: save.sets.length <= 1 ? 0.5 : 1 }}>
                          - Série
                        </button>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => collapseAndSave(ex.id)} style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '7px 16px', fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#111', cursor: 'pointer' }}>
                          Salvar ✓
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
                  onClick={() => setConfirmDeleteId(plan.id)}
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

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir plano de treino?"
        body={`"${plans.find(p => p.id === confirmDeleteId)?.title ?? 'Plano'}" e o vínculo com os treinos do dia serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir plano"
        onConfirm={() => {
          if (confirmDeleteId) handleDeletePlan(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
