'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import PlanSelector from '@/components/corpo/PlanSelector'
import EmptyState from '@/components/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/Toast'
import { getTrainingPlans, saveTrainingPlan, updateTrainingPlanRawContent } from '@/lib/supabase'
import {
  getTrainingEntries,
  getTrainingEntriesForRange,
  getPrevTrainingEntry,
  upsertTrainingEntry,
  deleteTrainingPlan,
} from '@/lib/body'
import { parseTrainingImport, type ParsedTrainingPlan, type TrainingExercisePlan } from '@/lib/body-plan'
import type { TrainingPlan, FileImportResult, TrainingEntry } from '@/types'
import { addDays, format, startOfWeek } from 'date-fns'
import { parseLocalDate } from '@/lib/date'

// ── Internal Types ─────────────────────────────────────────────────────────────

// done por série é opcional e aditivo: registos antigos (sem o campo) seguem
// válidos — série sem done conta como não concluída.
type ExerciseLoad = { weight: string; reps: string; done?: boolean }
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
export function prettyPlanName(title: string): string {
  return title
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Sugere a próxima sessão pela rotação: a seguir à última registada. Sem
// histórico, começa na primeira secção.
export function nextRotationIdx(prevSectionIdx: number | null, sectionCount: number): number {
  if (sectionCount <= 0) return 0
  if (prevSectionIdx === null) return 0
  return (prevSectionIdx + 1) % sectionCount
}

// ── Dia da semana embutido no título da secção ─────────────────────────────────
// Muitos planos importados nomeiam as sessões por dia ("Terça - B Costas").
// Quando presente, alimenta a fita semanal e a sugestão do dia; quando não,
// tudo degrada para a rotação simples.

const WEEK_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const WEEK_FULL_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const SECTION_WEEKDAYS: { dow: number; re: RegExp }[] = [
  { dow: 1, re: /\bsegunda\b/i },
  { dow: 2, re: /\bter[cç]a\b/i },
  { dow: 3, re: /\bquarta\b/i },
  { dow: 4, re: /\bquinta\b/i },
  { dow: 5, re: /\bsexta\b/i },
  { dow: 6, re: /\bs[aá]bado\b/i },
  { dow: 0, re: /\bdomingo\b/i },
]

export function sectionWeekday(title: string): number | null {
  for (const { dow, re } of SECTION_WEEKDAYS) if (re.test(title)) return dow
  return null
}

/** Remove o prefixo de dia da semana ("Terça - B Costas" → "B Costas"). */
export function cleanSectionTitle(title: string): string {
  const cleaned = title
    .replace(/^\s*(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(-feira)?\s*[-–—·:|]*\s*/i, '')
    .trim()
  return cleaned || title.trim()
}

/** Letra da sessão para a fita semanal ("B Costas Bíceps" → "B"). */
export function sectionLetter(cleanedTitle: string): string | null {
  const m = cleanedTitle.match(/^(?:treino\s+)?([A-Za-z])(?:\s|$|[-–—·:])/i)
  return m ? m[1].toUpperCase() : null
}

// ── Agenda semanal configurável (override dia → sessão) ─────────────────────────
// Por padrão, cada dia é atribuído automaticamente à sessão cujo título casa
// (sectionWeekday). O utilizador pode substituir essa atribuição por dia da
// semana; a substituição vive em training_plans.raw_content.schedule
// (chave = dow 0–6 como string, valor = sectionIdx ou null p/ descanso
// explícito) e sobrevive a reimportações do mesmo plano só enquanto o plano
// não for apagado/recriado.

export type ScheduleOverride = Record<number, number | null>

/** Lê e valida o override guardado no plano; entradas inválidas são ignoradas. */
export function getScheduleOverride(plan: { raw_content: Record<string, unknown> | null } | null): ScheduleOverride {
  const raw = plan?.raw_content?.schedule
  if (!raw || typeof raw !== 'object') return {}
  const out: ScheduleOverride = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const dow = Number(k)
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue
    if (v === null || Number.isInteger(v)) out[dow] = v as number | null
  }
  return out
}

export type DayAssignment =
  | { kind: 'section'; idx: number; overridden: boolean }
  | { kind: 'rest'; overridden: true }
  | { kind: 'unset'; overridden: false }

/**
 * Resolve o que treinar num dia da semana: override explícito do utilizador
 * primeiro (sessão ou descanso), senão a sessão cujo título casa com o dia,
 * senão "unset" (a rotação simples assume a partir daqui).
 */
export function resolveDayAssignment(
  dow: number,
  sections: { title: string }[],
  override: ScheduleOverride,
): DayAssignment {
  if (dow in override) {
    const v = override[dow]
    if (v === null) return { kind: 'rest', overridden: true }
    if (v >= 0 && v < sections.length) return { kind: 'section', idx: v, overridden: true }
    return { kind: 'unset', overridden: false } // override aponta p/ secção que já não existe
  }
  const byTitle = sections.findIndex(s => sectionWeekday(s.title) === dow)
  return byTitle >= 0 ? { kind: 'section', idx: byTitle, overridden: false } : { kind: 'unset', overridden: false }
}

// ── Detalhe do exercício ("4 | 8 a 12 | a definir | 90s") ──────────────────────

export function parseExerciseDetail(detail?: string): { sets: number | null; restSec: number | null } {
  if (!detail) return { sets: null, restSec: null }
  const parts = detail.split(/[|·]/).map(p => p.trim()).filter(Boolean)
  let sets: number | null = null
  let restSec: number | null = null
  for (const part of parts) {
    const restMatch = part.match(/^(\d+)\s*s(eg)?$/i)
    if (restMatch) { restSec = parseInt(restMatch[1], 10); continue }
    if (sets === null && /^\d{1,2}$/.test(part)) {
      const n = parseInt(part, 10)
      if (n >= 1 && n <= 12) sets = n
    }
  }
  return { sets, restSec }
}

/** Estimativa de duração: nº de séries × (execução ~40s + descanso do plano). */
export function estimateMinutes(exercises: TrainingExercisePlan[]): number | null {
  let totalSec = 0
  let known = 0
  for (const ex of exercises) {
    const { sets, restSec } = parseExerciseDetail(ex.detail)
    if (sets === null) continue
    known++
    totalSec += sets * (40 + (restSec ?? 75))
  }
  if (known === 0) return null
  // Exercícios sem detalhe herdam a média dos conhecidos.
  totalSec += (exercises.length - known) * (totalSec / known)
  return Math.max(5, Math.round(totalSec / 60 / 5) * 5)
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
  // Estado "ao abrir": sessão sugerida (dia da semana no título do plano, ou
  // rotação como fallback) + dias com treino concluído na semana corrente.
  // Só é usado quando ainda não há sessão escolhida no dia.
  const [entryHint, setEntryHint] = useState<{
    suggestIdx: number
    suggestIsToday: boolean
    isRestDay: boolean
    doneDates: string[]
  } | null>(null)
  // Folha do dia: qual dia da semana está aberto (ver + começar + trocar).
  const [pickerDow, setPickerDow] = useState<number | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  // Cronômetro de descanso: inicia ao concluir uma série/exercício. Guarda o
  // instante de fim; um tick de 500ms atualiza a contagem exibida.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  // Padrão de 1 min quando o plano não especifica o descanso do exercício
  // (o valor do plano, ex. "… | 90s", continua a ter precedência).
  const REST_SECONDS = 60
  // Player focado: índice do exercício em foco (plano + extras).
  const [exIdx, setExIdx] = useState(0)

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

  // ── Entry state: session suggestion + week strip data ────────────────────────
  // Corre quando ainda não há sessão escolhida hoje. O plano em foco é o
  // primeiro da lista (o mais recente); o utilizador pode trocar pelo seletor.
  const focusPlanId = plans[0]?.id ?? null
  useEffect(() => {
    if (planId || !focusPlanId) { setEntryHint(null); return }
    let cancelled = false
    async function loadHint() {
      if (!focusPlanId) return
      const todayDate = parseLocalDate(today)
      const weekStart = format(startOfWeek(todayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(addDays(startOfWeek(todayDate, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd')
      const [prev, range] = await Promise.all([
        getPrevTrainingEntry(userId, focusPlanId, today),
        getTrainingEntriesForRange(userId, weekStart, weekEnd),
      ])
      if (cancelled) return
      const focus = plans.find(p => p.id === focusPlanId) ?? null
      const sections = getParsed(focus)?.sections ?? []
      // Preferência: override do utilizador para hoje; senão o título que casa
      // com o dia da semana; senão a rotação simples.
      const todayDow = todayDate.getDay()
      const override = getScheduleOverride(focus)
      const assignment = resolveDayAssignment(todayDow, sections, override)
      const prevRow = prev as { notes: string | null } | null
      const prevIdx = prevRow ? parseNotes(prevRow.notes).sectionIdx : null
      let suggestIdx: number
      let suggestIsToday: boolean
      let isRestDay = false
      if (assignment.kind === 'section') {
        suggestIdx = assignment.idx
        suggestIsToday = true
      } else if (assignment.kind === 'rest') {
        suggestIdx = nextRotationIdx(prevIdx, sections.length)
        suggestIsToday = false
        isRestDay = true
      } else {
        suggestIdx = nextRotationIdx(prevIdx, sections.length)
        suggestIsToday = false
      }
      const doneDates = Array.from(
        new Set((range as TrainingEntry[]).filter(e => e.completed).map(e => e.date)),
      )
      setEntryHint({ suggestIdx, suggestIsToday, isRestDay, doneDates })
    }
    loadHint()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, focusPlanId, userId, today, plans])

  // ── Section selection ────────────────────────────────────────────────────────

  function selectSection(pid: string, si: number, st: string) {
    setPlanId(pid)
    setSectionIdx(si)
    setSectionTitle(st)
    setExIdx(0)
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
    setExIdx(0)
    setRestEndsAt(null)
    setShowSelector(false)
    try {
      localStorage.removeItem(sessionKey(today))
    } catch {
      // ignore
    }
  }

  // ── Agenda semanal: atribuir/limpar a sessão de um dia ───────────────────────

  async function persistSchedule(plan: TrainingPlan, next: ScheduleOverride, successMsg: string) {
    setScheduleSaving(true)
    const rawContent = { ...(plan.raw_content ?? {}), schedule: next }
    const { data } = await updateTrainingPlanRawContent(plan.id, userId, rawContent)
    if (data) {
      setPlans(prev => prev.map(p => (p.id === plan.id ? (data as TrainingPlan) : p)))
      toast.success(successMsg)
    }
    setScheduleSaving(false)
    setPickerDow(null)
  }

  /** Atribui `sectionIdx` ao dia `dow`; `null` marca descanso explícito. */
  function assignDay(plan: TrainingPlan, dow: number, sectionIdx: number | null, sectionName?: string) {
    const current = getScheduleOverride(plan)
    const dayName = WEEK_FULL_LABELS[dow]
    const msg = sectionIdx === null ? `${dayName} agora é descanso` : `${dayName} agora é ${sectionName ?? 'outro treino'}`
    persistSchedule(plan, { ...current, [dow]: sectionIdx }, msg)
  }

  /** Remove o override do dia, voltando à sugestão do plano. */
  function clearDayOverride(plan: TrainingPlan, dow: number) {
    const current = getScheduleOverride(plan)
    if (!(dow in current)) { setPickerDow(null); return }
    const next = { ...current }
    delete next[dow]
    persistSchedule(plan, next, `${WEEK_FULL_LABELS[dow]} voltou à sugestão do plano`)
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
    // Herda cargas/reps da última sessão, mas nunca os ticks de série.
    if (prevSaves[id]) return { done: false, sets: prevSaves[id].sets.map(s => ({ weight: s.weight, reps: s.reps })) }
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
    // Marcar o exercício inteiro também marca/limpa as séries (player focado).
    const updated = {
      ...saves,
      [id]: { done: willBeDone, sets: current.sets.map(s => ({ ...s, done: willBeDone })) },
    }
    setSaves(updated)
    scheduleSave(updated)
    // Ao concluir um exercício, arranca o descanso; ao desmarcar, limpa-o.
    setRestEndsAt(willBeDone ? Date.now() + REST_SECONDS * 1000 : null)
  }

  // Tick de uma série: marca a série, arranca o descanso (duração do plano se
  // conhecida) e conclui o exercício quando todas as séries estão feitas.
  function toggleSetDone(id: string, setIdx: number, restSec: number | null) {
    const current = getSave(id)
    const newSets = current.sets.map((s, i) => (i === setIdx ? { ...s, done: !s.done } : s))
    const nowDone = !current.sets[setIdx]?.done
    const allDone = newSets.every(s => s.done)
    const updated = { ...saves, [id]: { done: allDone, sets: newSets } }
    setSaves(updated)
    scheduleSave(updated)
    setRestEndsAt(nowDone ? Date.now() + (restSec ?? REST_SECONDS) * 1000 : null)
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

  /** Resumo da última sessão ("40 kg × 10 · 3 séries") para o player focado. */
  function prevSessionLabel(id: string): string | null {
    const prev = prevSaves[id]
    if (!prev || prev.sets.length === 0) return null
    const valid = prev.sets.filter(s => s.weight.trim() !== '' || s.reps.trim() !== '')
    if (valid.length === 0) return null
    const first = prev.sets[0]
    const allSame = prev.sets.every(s => s.weight === first.weight && s.reps === first.reps)
    const count = `${prev.sets.length} ${prev.sets.length === 1 ? 'série' : 'séries'}`
    if (!allSame) return `${count} · variado`
    const w = first.weight ? `${first.weight} kg` : ''
    const r = first.reps ? `× ${first.reps}` : ''
    const load = [w, r].filter(Boolean).join(' ')
    return load ? `${load} · ${count}` : count
  }

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
    // Copia carga/reps da última série, mas nunca o tick.
    const newSets = [...current.sets, { weight: last.weight, reps: last.reps }]
    // Série nova por marcar → o exercício deixa de estar concluído.
    const updated = { ...saves, [id]: { done: false, sets: newSets } }
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

  // Fita semanal SEG–DOM: sempre visível quando o plano tem sessões — dias sem
  // treino mostram "·" e o toque abre a folha do dia para atribuir um.
  const scheduleOverride = getScheduleOverride(focusPlan)
  const todayDow = parseLocalDate(today).getDay()
  const weekMonday = startOfWeek(parseLocalDate(today), { weekStartsOn: 1 })
  const weekStrip = focusSections.length > 0
    ? WEEK_LABELS.map((label, i) => {
        const dow = (i + 1) % 7 // SEG=1 … SÁB=6, DOM=0
        const assignment = resolveDayAssignment(dow, focusSections, scheduleOverride)
        const section = assignment.kind === 'section' ? focusSections[assignment.idx] : null
        const dateStr = format(addDays(weekMonday, i), 'yyyy-MM-dd')
        return {
          label,
          dow,
          assignment,
          letter: section ? (sectionLetter(cleanSectionTitle(section.title)) ?? '•') : null,
          isToday: dow === todayDow,
          done: entryHint?.doneDates.includes(dateStr) ?? false,
        }
      })
    : null
  const weekTarget = weekStrip
    ? weekStrip.filter(d => d.assignment.kind === 'section').length
    : focusSections.length
  const weekDone = entryHint?.doneDates.length ?? 0
  const suggestedMinutes = focusSections[suggestIdx]
    ? estimateMinutes(focusSections[suggestIdx].exercises)
    : null
  // Conta plano + extras em ambos os lados (barra e persistência) — P2.3.
  const doneCount =
    exercises.filter(e => saves[e.id]?.done).length +
    extras.filter(e => saves[e.id]?.done).length
  const totalCount = exercises.length + extras.length

  // Player focado: exercícios do plano + extras numa lista única.
  const allExercises: TrainingExercisePlan[] = [...exercises, ...extras]
  const focusExIdx = allExercises.length > 0 ? Math.min(exIdx, allExercises.length - 1) : 0
  const currentEx = allExercises[focusExIdx] ?? null
  const currentIsExtra = focusExIdx >= exercises.length
  const nextIncompleteIdx = allExercises.findIndex((e, i) => i !== focusExIdx && !getSave(e.id).done)

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
          {/* Cabeçalho: chip do plano + botão de trocar plano */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gold-ink)', background: 'rgba(232,168,56,.13)', borderRadius: 100, padding: '6px 13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prettyPlanName(focusPlan.title)}
            </span>
            <button
              onClick={() => setShowSelector(true)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 11.5, color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
            >
              Trocar plano
            </button>
          </div>

          {/* Fita semanal SEG–DOM: toque abre a folha do dia (ver + trocar) */}
          {weekStrip && (
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 12px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  Sua semana
                </span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10.5, color: 'var(--text3)' }}>
                  {weekTarget > 0 ? `${weekTarget}× / semana · ` : ''}toca num dia p/ ver ou trocar
                </span>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {weekStrip.map(day => {
                  const isRest = day.assignment.kind === 'rest'
                  const overriddenSection = day.assignment.kind === 'section' && day.assignment.overridden
                  return (
                    <button
                      key={day.label}
                      onClick={() => setPickerDow(day.dow)}
                      aria-label={`Ver ou trocar o treino de ${WEEK_FULL_LABELS[day.dow]}`}
                      style={{
                        position: 'relative',
                        flex: 1,
                        borderRadius: 11,
                        padding: '10px 0 9px',
                        minHeight: 46,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: day.isToday ? 'rgba(232,168,56,.14)' : 'var(--bg2)',
                        border: `1px solid ${day.isToday ? 'rgba(232,168,56,.55)' : day.done ? 'rgba(30,203,180,.4)' : 'var(--border)'}`,
                      }}
                    >
                      {day.isToday && (
                        <span style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--on-bright)', background: 'var(--gold)', borderRadius: 100, padding: '1px 5px' }}>
                          HOJE
                        </span>
                      )}
                      {day.done && (
                        <span aria-hidden style={{ position: 'absolute', top: -5, right: -3, width: 14, height: 14, borderRadius: '50%', background: 'var(--teal)', color: 'var(--on-bright)', fontSize: 8.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg1)' }}>
                          ✓
                        </span>
                      )}
                      <div style={{ fontSize: 8.5, color: 'var(--text3)', letterSpacing: '0.03em', fontFamily: 'DM Sans, sans-serif' }}>
                        {day.label}
                      </div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: day.letter ? 800 : 600, fontSize: 14, marginTop: 3, color: day.done ? 'var(--teal)' : day.isToday ? 'var(--gold)' : isRest ? 'var(--text3)' : day.letter ? 'var(--text1)' : 'var(--text3)' }}>
                        {isRest ? '–' : (day.letter ?? '·')}
                      </div>
                      {overriddenSection && (
                        <span aria-hidden style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Card da sessão sugerida */}
          {focusSections[suggestIdx] && (
            <div style={{ background: 'var(--bg1)', border: '1px solid rgba(232,168,56,.30)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gold-ink)', background: 'rgba(232,168,56,.13)', borderRadius: 100, padding: '4px 10px' }}>
                  {entryHint?.suggestIsToday ? `Hoje · ${WEEK_FULL_LABELS[todayDow]}` : 'Sugerido p/ hoje'}
                </span>
                {weekDone > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--teal-ink)', background: 'rgba(30,203,180,.13)', borderRadius: 100, padding: '4px 10px' }}>
                    🔥 {weekDone}/{weekTarget || focusSections.length} esta semana
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(232,168,56,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 19 }}>💪</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--text1)', margin: 0, lineHeight: 1.25 }}>
                    {cleanSectionTitle(focusSections[suggestIdx].title)}
                  </p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>
                    {focusSections[suggestIdx].exercises.length} exercícios
                    {suggestedMinutes ? ` · ~${suggestedMinutes} min` : ''}
                  </p>
                </div>
              </div>
              {entryHint && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🧭</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text1)', lineHeight: 1.45 }}>
                    {entryHint.isRestDay
                      ? 'Marcaste hoje como descanso — mas se mudares de ideia, aqui vai uma sugestão.'
                      : entryHint.suggestIsToday
                        ? weekDone === 0
                          ? 'É o treino marcado para hoje — bora abrir bem a semana.'
                          : `É o treino de hoje. Já são ${weekDone} na semana — segue o ritmo.`
                        : weekDone === 0
                          ? 'Primeira sessão da semana — a rotação sugere esta.'
                          : `Boa constância: ${weekDone} esta semana. A rotação sugere esta.`}
                  </span>
                </div>
              )}
              <button
                onClick={() => selectSection(focusPlan.id, suggestIdx, focusSections[suggestIdx].title)}
                style={{ width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none', borderRadius: 13, padding: 13, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                {entryHint?.suggestIsToday ? 'Começar treino de hoje' : 'Começar esta sessão'}
              </button>
            </div>
          )}

          {/* Outras sessões do plano — grelha compacta */}
          {focusSections.length > 1 && (
            <div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text3)', margin: '4px 2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Outras sessões
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {focusSections.map((s, i) => {
                  if (i === suggestIdx) return null
                  const dow = sectionWeekday(s.title)
                  const dayLabel = dow !== null ? WEEK_LABELS[(dow + 6) % 7] : null
                  return (
                    <button
                      key={i}
                      onClick={() => selectSection(focusPlan.id, i, s.title)}
                      style={{ textAlign: 'left', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', cursor: 'pointer', minWidth: 0 }}
                    >
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--text3)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {dayLabel ?? 'Sessão'}
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text1)', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {cleanSectionTitle(s.title)}
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text3)', margin: '3px 0 0' }}>
                        {s.exercises.length} exercícios
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Folha do dia: ver + começar + trocar num lugar só ──────────────── */}
      {pickerDow !== null && focusPlan && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setPickerDow(null)}
        >
          <div style={{ width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', padding: '14px 18px calc(20px + env(safe-area-inset-bottom))', maxHeight: 'min(82dvh, 660px)', overflowY: 'auto' }}>
            <div aria-hidden style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '0 auto 13px' }} />
            {(() => {
              const currentAssignment = resolveDayAssignment(pickerDow, focusSections, scheduleOverride)
              const autoIdx = focusSections.findIndex(s => sectionWeekday(s.title) === pickerDow)
              const autoName = autoIdx >= 0 ? cleanSectionTitle(focusSections[autoIdx].title) : 'dia livre'
              const currentIdx = currentAssignment.kind === 'section' ? currentAssignment.idx : -1
              const currentSectionForDay = currentIdx >= 0 ? focusSections[currentIdx] : null
              return (
                <div style={{ opacity: scheduleSaving ? 0.6 : 1, pointerEvents: scheduleSaving ? 'none' : 'auto' }}>
                  {/* Cabeçalho */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                    <div>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text1)', margin: 0 }}>
                        {WEEK_FULL_LABELS[pickerDow]}
                      </p>
                      {currentAssignment.overridden && (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(127,119,221,.14)', borderRadius: 100, padding: '3px 9px' }}>
                          trocado por você
                        </span>
                      )}
                    </div>
                    <button onClick={() => setPickerDow(null)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer', color: 'var(--text2)', flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>

                  {/* Sessão atual do dia + começar */}
                  {currentSectionForDay && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(232,168,56,.10)', border: '1px solid rgba(232,168,56,.5)', borderRadius: 12, padding: '11px 13px', marginBottom: 10 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(232,168,56,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 12.5, color: 'var(--gold-ink)', flexShrink: 0 }}>
                          {sectionLetter(cleanSectionTitle(currentSectionForDay.title)) ?? String(currentIdx + 1)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', fontSize: 13.5, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cleanSectionTitle(currentSectionForDay.title)}
                          </span>
                          <span style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>
                            {currentSectionForDay.exercises.length} exercícios
                            {estimateMinutes(currentSectionForDay.exercises) ? ` · ~${estimateMinutes(currentSectionForDay.exercises)} min` : ''}
                          </span>
                        </span>
                        <span style={{ color: 'var(--gold-ink)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                      </div>
                      <button
                        onClick={() => { setPickerDow(null); selectSection(focusPlan.id, currentIdx, currentSectionForDay.title) }}
                        style={{ width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none', borderRadius: 13, padding: 12, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', letterSpacing: '0.02em', marginBottom: 14 }}
                      >
                        Começar {cleanSectionTitle(currentSectionForDay.title)}
                      </button>
                    </>
                  )}
                  {currentAssignment.kind === 'rest' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(127,119,221,.10)', border: '1px solid rgba(127,119,221,.5)', borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>
                      <span style={{ fontSize: 15, width: 28, textAlign: 'center', flexShrink: 0 }}>💤</span>
                      <span style={{ flex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: 13.5, fontWeight: 600, color: 'var(--text2)' }}>Descanso</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                    </div>
                  )}
                  {currentAssignment.kind === 'unset' && (
                    <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12, padding: '11px 13px', marginBottom: 14, fontFamily: 'DM Sans, sans-serif', fontSize: 12.5, color: 'var(--text3)' }}>
                      Nenhum treino marcado para este dia.
                    </div>
                  )}

                  {/* Trocar o treino deste dia */}
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text3)', margin: '0 0 8px' }}>
                    Trocar o treino deste dia
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {focusSections.map((s, i) => {
                      if (i === currentIdx) return null
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            // Escolher a própria sugestão do plano = limpar o override
                            // (mantém o dia sincronizado com o plano, não congela cópia).
                            if (i === autoIdx) clearDayOverride(focusPlan, pickerDow)
                            else assignDay(focusPlan, pickerDow, i, cleanSectionTitle(s.title))
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', cursor: 'pointer' }}
                        >
                          <span style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(232,168,56,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 12.5, color: 'var(--gold-ink)', flexShrink: 0 }}>
                            {sectionLetter(cleanSectionTitle(s.title)) ?? String(i + 1)}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cleanSectionTitle(s.title)}
                            </span>
                            <span style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>
                              {s.exercises.length} exercícios
                            </span>
                          </span>
                          {i === autoIdx && (
                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 100, padding: '3px 8px', flexShrink: 0 }}>
                              sugestão do plano
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {currentAssignment.kind !== 'rest' && (
                      <button
                        onClick={() => assignDay(focusPlan, pickerDow, null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: 15, width: 28, textAlign: 'center', flexShrink: 0 }}>💤</span>
                        <span style={{ flex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Descanso</span>
                      </button>
                    )}
                  </div>

                  {currentAssignment.overridden && (
                    <button
                      onClick={() => clearDayOverride(focusPlan, pickerDow)}
                      style={{ marginTop: 11, background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textAlign: 'left', padding: '2px' }}
                    >
                      ↩︎ Voltar à sugestão do plano ({autoName})
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
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
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--text1)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {cleanSectionTitle(sectionTitle)}
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

          {/* Progresso da sessão */}
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
                  {saving ? 'Salvando…' : `${doneCount}/${totalCount} exercícios`}
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  {focusExIdx + 1} / {totalCount}
                </span>
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
                    background: 'var(--gold)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Player focado: um exercício por vez ─────────────────────────── */}
          {currentEx && (() => {
            const save = getSave(currentEx.id)
            const inherited = isInherited(currentEx.id)
            const hint = !save.done ? progressionHint(currentEx.id) : null
            const last = prevSessionLabel(currentEx.id)
            const { restSec } = parseExerciseDetail(currentEx.detail)
            return (
              <div style={{ background: 'var(--bg1)', border: '1px solid rgba(232,168,56,.30)', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--text1)', margin: 0, lineHeight: 1.25, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {currentEx.name}
                  </p>
                  {hint && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(127,119,221,.14)', borderRadius: 100, padding: '4px 10px', flexShrink: 0 }}>
                      <span style={{ fontSize: 11 }}>🧭</span>
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{hint}</span>
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text3)', margin: '0 0 10px', fontStyle: inherited ? 'italic' : 'normal' }}>
                  {last ? `última vez: ${last}` : (currentEx.detail ?? 'primeira vez — registra as tuas séries')}
                </p>

                {/* Séries: KG · REPS · tick */}
                <div>
                  {save.sets.map((s, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: si > 0 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--text3)', width: 16, flexShrink: 0 }}>
                        {si + 1}
                      </span>
                      <label style={{ flex: 1, background: 'var(--bg2)', border: `1px solid ${s.done ? 'rgba(30,203,180,.45)' : 'var(--border)'}`, borderRadius: 10, padding: '5px 4px 4px', textAlign: 'center', display: 'block', minWidth: 0 }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={s.weight}
                          placeholder="0"
                          aria-label={`Carga da série ${si + 1}`}
                          onChange={e => updateSet(currentEx.id, si, 'weight', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: s.done ? 'var(--teal)' : 'var(--text1)', padding: 0 }}
                        />
                        <span style={{ display: 'block', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text3)' }}>KG</span>
                      </label>
                      <label style={{ flex: 1, background: 'var(--bg2)', border: `1px solid ${s.done ? 'rgba(30,203,180,.45)' : 'var(--border)'}`, borderRadius: 10, padding: '5px 4px 4px', textAlign: 'center', display: 'block', minWidth: 0 }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={s.reps}
                          placeholder="0"
                          aria-label={`Repetições da série ${si + 1}`}
                          onChange={e => updateSet(currentEx.id, si, 'reps', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: s.done ? 'var(--teal)' : 'var(--text1)', padding: 0 }}
                        />
                        <span style={{ display: 'block', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text3)' }}>REPS</span>
                      </label>
                      <button
                        onClick={() => toggleSetDone(currentEx.id, si, restSec)}
                        aria-pressed={s.done ?? false}
                        aria-label={`${s.done ? 'Desmarcar' : 'Concluir'} série ${si + 1}`}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: s.done ? 'none' : '2px solid var(--text3)', background: s.done ? 'var(--teal)' : 'transparent', color: 'var(--on-accent)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, padding: 0 }}
                      >
                        {s.done ? '✓' : ''}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Controles de série */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <button
                    onClick={() => addSet(currentEx.id)}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    + Série
                  </button>
                  <button
                    onClick={() => removeSet(currentEx.id)}
                    disabled={save.sets.length <= 1}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: save.sets.length <= 1 ? 'var(--text3)' : 'var(--text2)', cursor: save.sets.length <= 1 ? 'not-allowed' : 'pointer', opacity: save.sets.length <= 1 ? 0.5 : 1 }}
                  >
                    – Série
                  </button>
                  <div style={{ flex: 1 }} />
                  {currentIsExtra && (
                    <button
                      onClick={() => {
                        setExtras(prev => prev.filter(e => e.id !== currentEx.id))
                        setExIdx(0)
                      }}
                      style={{ background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    >
                      remover
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Cronômetro de descanso */}
          {restEndsAt !== null && restRemaining > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(30,203,180,.10)', border: '1px solid rgba(30,203,180,.3)', borderRadius: 100, padding: '9px 12px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--teal-ink)' }}>
                ⏱ Descanso · {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
              </span>
              <button
                onClick={() => setRestEndsAt(prev => (prev ?? Date.now()) + 30000)}
                style={{ background: 'rgba(30,203,180,.14)', border: 'none', borderRadius: 8, padding: '4px 10px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--teal-ink)', cursor: 'pointer' }}
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

          {/* Avançar / concluir */}
          {allExercises.length > 0 && (
            doneCount >= totalCount ? (
              <button
                onClick={() => { toast.success('Treino concluído! 💪'); deselectSession() }}
                style={{ width: '100%', background: 'var(--teal)', color: 'var(--on-bright)', border: 'none', borderRadius: 13, padding: 13, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Concluir treino ✓
              </button>
            ) : (
              <button
                onClick={() => { if (nextIncompleteIdx >= 0) setExIdx(nextIncompleteIdx) }}
                style={{ width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none', borderRadius: 13, padding: 13, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Próximo exercício →
              </button>
            )
          )}

          {/* Lista da sessão: tocar salta para o exercício */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allExercises.map((ex, i) => {
              const save = getSave(ex.id)
              const label = setLabel(save)
              const inherited = isInherited(ex.id)
              const isFocus = i === focusExIdx
              return (
                <div
                  key={ex.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg1)', border: `1px solid ${isFocus ? 'rgba(232,168,56,.45)' : 'var(--border)'}`, borderRadius: 12, padding: '10px 12px' }}
                >
                  <button
                    onClick={() => toggleDone(ex.id)}
                    aria-label={save.done ? `Desmarcar ${ex.name}` : `Concluir ${ex.name}`}
                    style={{ width: 22, height: 22, borderRadius: '50%', border: save.done ? 'none' : '2px solid var(--text3)', background: save.done ? 'var(--teal)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', fontSize: 12, fontWeight: 800, padding: 0 }}
                  >
                    {save.done ? '✓' : ''}
                  </button>
                  <button
                    onClick={() => setExIdx(i)}
                    style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: save.done ? 'var(--text3)' : 'var(--text1)', margin: 0, textDecoration: save.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.name}
                    </p>
                    {(label || ex.detail) && (
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: label && !inherited ? 'var(--teal)' : 'var(--text3)', fontStyle: inherited ? 'italic' : 'normal', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label ? (inherited ? `última sessão · ${label}` : label) : ex.detail}
                      </p>
                    )}
                  </button>
                  {isFocus && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--gold-ink)', flexShrink: 0 }}>
                      agora
                    </span>
                  )}
                </div>
              )
            })}

            {/* Adicionar exercício extra */}
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
