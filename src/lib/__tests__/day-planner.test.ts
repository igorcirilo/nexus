import { describe, it, expect } from 'vitest'
import { buildDayPlan, prioritize, type PlannerInput, type PlanItem } from '@/lib/day-planner'
import type { ProgramTask, Goal90, Habit, HabitArea } from '@/types'
import type { AgendaEvent } from '@/lib/supabase'

// ── Fábricas de teste ──────────────────────────────────────
function habit(over: Partial<Habit> & { done?: boolean } = {}) {
  const { done, ...rest } = over
  const h: Habit = {
    id: rest.id ?? 'h1',
    user_id: 'u',
    name: rest.name ?? 'Hábito',
    area: rest.area ?? 'corpo',
    xp_reward: 0,
    time_window: rest.time_window ?? null,
    active: true,
    created_at: '2026-01-01',
    source: 'manual',
    difficulty: rest.difficulty ?? 2,
    catalog_key: null,
    ...rest,
  }
  return { ...h, habit_logs: done ? [{ completed: true, date: '2026-06-25' }] : [] }
}

function task(over: Partial<ProgramTask> = {}): ProgramTask {
  return {
    id: over.id ?? 't1',
    program_id: 'p',
    day_id: 'd',
    user_id: 'u',
    template_id: null,
    title: over.title ?? 'Tarefa',
    description: null,
    area: over.area ?? 'carreira',
    difficulty: over.difficulty ?? 2,
    xp_reward: 0,
    status: over.status ?? 'pending',
    source: 'generated',
    completed_at: null,
    created_at: '2026-06-25',
    ...over,
  }
}

function event(over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: over.id ?? 'e1',
    user_id: 'u',
    title: over.title ?? 'Reunião',
    description: null,
    date: '2026-06-25',
    time: over.time ?? '15:00',
    end_time: null,
    color: '#000',
    all_day: over.all_day ?? false,
    created_at: '2026-06-25',
    ...over,
  }
}

function goal(over: Partial<Goal90> = {}): Goal90 {
  return {
    id: over.id ?? 'g1',
    user_id: 'u',
    title: over.title ?? 'Objetivo',
    area: over.area ?? 'financas',
    start_date: '2026-06-01',
    end_date: '2026-09-01',
    progress: over.progress ?? 0,
    status: over.status ?? 'active',
    created_at: '2026-06-01',
    ...over,
  }
}

function input(over: Partial<PlannerInput> = {}): PlannerInput {
  return {
    phase: 'manha',
    hour: 9,
    energy: 6,
    programTasks: [],
    habits: [],
    events: [],
    goals: [],
    areaScores: {},
    ...over,
  }
}

describe('buildDayPlan', () => {
  it('entrada vazia → plano vazio sem erro', () => {
    const plan = buildDayPlan(input())
    expect(plan.items).toEqual([])
    expect(plan.focusSuggestion).toBeNull()
    expect(plan.capacityHint).toBe('Dia limpo — está tudo feito. 🎯')
  })

  it('ordena pendentes por prioridade desc e empurra concluídos para o fim', () => {
    const plan = buildDayPlan(
      input({
        habits: [habit({ id: 'a', name: 'A', done: true }), habit({ id: 'b', name: 'B' })],
      }),
    )
    const last = plan.items[plan.items.length - 1]
    expect(last.done).toBe(true)
    // os pendentes vêm antes do concluído
    expect(plan.items[0].done).toBe(false)
  })

  it('evento iminente recebe urgência alta', () => {
    const plan = buildDayPlan(
      input({ hour: 14, phase: 'tarde', events: [event({ time: '15:00' })] }),
    )
    const ev = plan.items.find((i) => i.kind === 'event')!
    expect(ev.priority).toBeGreaterThanOrEqual(40)
  })

  it('energia baixa reduz os destaques para 2', () => {
    const plan = buildDayPlan(
      input({
        energy: 2,
        habits: [habit({ id: '1' }), habit({ id: '2' }), habit({ id: '3' }), habit({ id: '4' })],
      }),
    )
    expect(plan.items.filter((i) => i.isPriority).length).toBe(2)
    expect(plan.capacityHint).toContain('Energia baixa')
  })

  it('energia normal destaca até 3', () => {
    const plan = buildDayPlan(
      input({
        energy: 6,
        habits: [habit({ id: '1' }), habit({ id: '2' }), habit({ id: '3' }), habit({ id: '4' })],
      }),
    )
    expect(plan.items.filter((i) => i.isPriority).length).toBe(3)
  })

  it('área mais fraca sobe no ranking face a área forte (igual no resto)', () => {
    const areas: Partial<Record<HabitArea, number>> = { corpo: 10, carreira: 90 }
    const plan = buildDayPlan(
      input({
        areaScores: areas,
        habits: [
          habit({ id: 'forte', name: 'Forte', area: 'carreira' }),
          habit({ id: 'fraca', name: 'Fraca', area: 'corpo' }),
        ],
      }),
    )
    const fraca = plan.items.find((i) => i.label === 'Fraca')!
    const forte = plan.items.find((i) => i.label === 'Forte')!
    expect(fraca.priority).toBeGreaterThan(forte.priority)
  })

  it('item concluído tem prioridade 0', () => {
    expect(
      prioritize(
        { id: 'x', sourceId: 'x', kind: 'habit', label: 'X', priority: 0, isPriority: false, done: true } as PlanItem,
        input(),
      ),
    ).toBe(0)
  })

  it('expõe o sourceId cru (sem prefixo) para cada tipo', () => {
    const plan = buildDayPlan(
      input({
        programTasks: [task({ id: 't9' })],
        habits: [habit({ id: 'h9' })],
        events: [event({ id: 'e9' })],
        goals: [goal({ id: 'g9' })],
      }),
    )
    const byKind = Object.fromEntries(plan.items.map((i) => [i.kind, i.sourceId]))
    expect(byKind).toEqual({ task: 't9', habit: 'h9', event: 'e9', milestone: 'g9' })
  })

  it('inclui tarefas, hábitos, eventos e milestones de objetivos ativos', () => {
    const plan = buildDayPlan(
      input({
        programTasks: [task()],
        habits: [habit()],
        events: [event()],
        goals: [goal()],
      }),
    )
    const kinds = new Set(plan.items.map((i) => i.kind))
    expect(kinds).toEqual(new Set(['task', 'habit', 'event', 'milestone']))
  })
})
