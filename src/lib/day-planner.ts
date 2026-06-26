// src/lib/day-planner.ts
//
// Planeador do dia — monta e ordena o "plano de hoje" a partir das fontes que
// já existem (programa, hábitos, agenda, objetivos), sem IA e sem IO. A UI (e,
// no futuro, a edge function de resumos) faz o fetch e passa os dados já
// carregados para estas funções puras → testáveis sem mock de rede.
//
// Mesmo padrão determinístico de src/lib/mentor.ts: entra contexto, sai um
// resultado estável. Nada aqui depende de browser, Supabase ou Date.now().

import type { ProgramTask, Goal90, Habit, HabitArea } from '@/types'
import type { AgendaEvent } from '@/lib/supabase'

/** Hábito com os seus logs do dia (mesma forma usada no HojeClient). */
export type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

export interface PlannerInput {
  phase: 'manha' | 'tarde' | 'noite'
  hour: number
  /** Energia do check-in da manhã (1–10). null = sem check-in → assume neutro. */
  energy: number | null
  programTasks: ProgramTask[]
  habits: HabitWithLog[]
  /** Eventos de agenda já filtrados para hoje. */
  events: AgendaEvent[]
  /** Objetivos 90 dias ativos (para milestones próximos). */
  goals: Goal90[]
  /** Score por área de vida (0–100). Área em falta = neutro (50). */
  areaScores: Partial<Record<HabitArea, number>>
}

export type PlanItemKind = 'task' | 'habit' | 'event' | 'milestone'

export interface PlanItem {
  id: string
  /** Id da entidade subjacente (sem prefixo) — usado p.ex. para marcar hábitos. */
  sourceId: string
  kind: PlanItemKind
  label: string
  area?: HabitArea
  timeWindow?: 'manha' | 'tarde' | 'noite' | null
  /** Hora agendada 'HH:MM' (só eventos). */
  scheduledAt?: string | null
  /** Score 0–100 calculado por prioritize(). */
  priority: number
  /** Faz parte do top-N destacado. */
  isPriority: boolean
  done: boolean
}

export interface DayPlan {
  items: PlanItem[]
  /** Sugestão de bloco de foco (texto template, sem LLM). */
  focusSuggestion: string | null
  /** Aviso sobre capacidade do dia (ex.: energia baixa). */
  capacityHint: string | null
}

const NEUTRAL_ENERGY = 6
const NEUTRAL_AREA_SCORE = 50

/** Energia "efetiva": usa a real ou cai para neutro quando não há check-in. */
function effectiveEnergy(energy: number | null): number {
  return energy == null ? NEUTRAL_ENERGY : energy
}

function isLowEnergy(energy: number | null): boolean {
  return effectiveEnergy(energy) <= 3
}

/** 'HH:MM' → hora como número (0–23.99) ou null se inválido. */
function parseHour(time: string | null | undefined): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return h + min / 60
}

function timeWindowForHour(hour: number): 'manha' | 'tarde' | 'noite' {
  if (hour < 12) return 'manha'
  if (hour < 18) return 'tarde'
  return 'noite'
}

/**
 * Score de prioridade 0–100. Somatório ponderado e determinístico:
 * - Urgência temporal (até ~40): evento próximo > item da janela atual > resto.
 * - Reforço de área fraca (até ~25): quanto menor o score da área, maior o peso.
 * - Risco de quebra (até ~20): hábito por fazer perto do fim do dia.
 * - Ajuste por energia (±15): energia baixa penaliza dificuldade alta.
 */
export function prioritize(item: PlanItem, ctx: PlannerInput): number {
  if (item.done) return 0

  let score = 0

  // ── Urgência temporal (0–40) ──────────────────────────────
  if (item.kind === 'event') {
    const evHour = parseHour(item.scheduledAt)
    if (evHour != null) {
      const delta = evHour - ctx.hour
      if (delta < 0) {
        score += 5 // já passou hoje — pouca urgência
      } else if (delta <= 1) {
        score += 40 // iminente
      } else if (delta <= 3) {
        score += 30
      } else {
        score += 20
      }
    } else {
      score += 18 // evento sem hora
    }
  } else if (item.timeWindow && item.timeWindow === timeWindowForHour(ctx.hour)) {
    score += 22 // pertence à janela atual do dia
  } else if (item.kind === 'milestone') {
    score += 14
  } else {
    score += 10
  }

  // ── Reforço de área fraca (0–25) ──────────────────────────
  if (item.area) {
    const areaScore = ctx.areaScores[item.area] ?? NEUTRAL_AREA_SCORE
    score += ((100 - areaScore) / 100) * 25
  }

  // ── Risco de quebra (0–20) ────────────────────────────────
  if (item.kind === 'habit' && !item.done) {
    if (ctx.hour >= 20) score += 20
    else if (ctx.hour >= 18) score += 12
    else score += 4
  }

  // ── Ajuste por energia (±15) ──────────────────────────────
  const energy = effectiveEnergy(ctx.energy)
  const difficulty = difficultyOf(item)
  if (energy <= 3) {
    // Dia de baixa energia: favorece o fácil, penaliza o difícil.
    score += difficulty >= 3 ? -15 : difficulty === 1 ? 8 : 0
  } else if (energy >= 8 && ctx.phase === 'manha') {
    // Muita energia de manhã: empurra o trabalho difícil para cima.
    score += difficulty >= 3 ? 12 : 0
  }

  return clamp(Math.round(score), 0, 100)
}

/** Dificuldade conhecida do item (hábitos e tarefas têm; resto = média). */
function difficultyOf(item: PlanItem): 1 | 2 | 3 {
  const d = (item as { _difficulty?: 1 | 2 | 3 })._difficulty
  return d ?? 2
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function habitDone(h: HabitWithLog): boolean {
  return Boolean(h.habit_logs && h.habit_logs.length > 0 && h.habit_logs[0].completed)
}

/** Constrói o plano do dia: mapeia fontes → PlanItem, prioriza, ordena, destaca. */
export function buildDayPlan(input: PlannerInput): DayPlan {
  const raw: PlanItem[] = []

  // Eventos de agenda.
  for (const ev of input.events) {
    raw.push({
      id: `event-${ev.id}`,
      sourceId: ev.id,
      kind: 'event',
      label: ev.title,
      scheduledAt: ev.all_day ? null : ev.time,
      timeWindow: ev.time ? timeWindowForHour(parseHour(ev.time) ?? 12) : null,
      priority: 0,
      isPriority: false,
      done: false,
    })
  }

  // Tarefas do programa (só as pendentes entram no plano de ação).
  for (const t of input.programTasks) {
    raw.push(
      withDifficulty(
        {
          id: `task-${t.id}`,
          sourceId: t.id,
          kind: 'task',
          label: t.title,
          area: t.area,
          priority: 0,
          isPriority: false,
          done: t.status === 'completed' || t.status === 'skipped',
        },
        t.difficulty,
      ),
    )
  }

  // Hábitos do dia.
  for (const h of input.habits) {
    raw.push(
      withDifficulty(
        {
          id: `habit-${h.id}`,
          sourceId: h.id,
          kind: 'habit',
          label: h.name,
          area: h.area,
          timeWindow: normalizeWindow(h.time_window),
          priority: 0,
          isPriority: false,
          done: habitDone(h),
        },
        h.difficulty,
      ),
    )
  }

  // Milestones de objetivos 90 dias ativos.
  for (const g of input.goals) {
    if (g.status !== 'active') continue
    raw.push({
      id: `goal-${g.id}`,
      sourceId: g.id,
      kind: 'milestone',
      label: g.title,
      area: g.area,
      priority: 0,
      isPriority: false,
      done: g.progress >= 100,
    })
  }

  // Pontua e ordena: pendentes por prioridade desc; concluídos no fim.
  const scored = raw.map((it) => ({ ...it, priority: prioritize(it, input) }))
  scored.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.priority - a.priority
  })

  // Destaca o top-N dos pendentes (2 em dia de baixa energia, senão 3).
  const topN = isLowEnergy(input.energy) ? 2 : 3
  let marked = 0
  for (const it of scored) {
    if (!it.done && marked < topN) {
      it.isPriority = true
      marked++
    }
  }

  return {
    items: scored,
    focusSuggestion: buildFocusSuggestion(scored, input),
    capacityHint: buildCapacityHint(scored, input),
  }
}

/** Anexa a dificuldade (consumida por prioritize) sem a expor no tipo público. */
function withDifficulty(item: PlanItem, difficulty: 1 | 2 | 3): PlanItem {
  ;(item as { _difficulty?: 1 | 2 | 3 })._difficulty = difficulty
  return item
}

function normalizeWindow(tw: string | null): 'manha' | 'tarde' | 'noite' | null {
  if (tw === 'manha' || tw === 'tarde' || tw === 'noite') return tw
  return null
}

/** Texto de sugestão de foco — template, sem LLM. */
function buildFocusSuggestion(items: PlanItem[], input: PlannerInput): string | null {
  const top = items.find((it) => !it.done && it.isPriority)
  if (!top) return null
  if (input.phase === 'manha') {
    return `Começa por: ${top.label}.`
  }
  if (input.phase === 'tarde') {
    return `Foco da tarde: ${top.label}.`
  }
  return `Antes de fechar o dia: ${top.label}.`
}

/** Aviso de capacidade — template, sem LLM. */
function buildCapacityHint(items: PlanItem[], input: PlannerInput): string | null {
  const pending = items.filter((it) => !it.done)
  if (pending.length === 0) return 'Dia limpo — está tudo feito. 🎯'
  if (isLowEnergy(input.energy)) {
    return 'Energia baixa hoje — foca-te só nos 2 essenciais e descansa o resto.'
  }
  if (effectiveEnergy(input.energy) >= 8 && input.phase === 'manha') {
    return 'Boa energia — aproveita a manhã para o que é mais difícil.'
  }
  return null
}
