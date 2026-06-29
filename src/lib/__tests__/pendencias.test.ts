import { describe, it, expect } from 'vitest'
import { detectPendencias, type PendenciaInput } from '@/lib/pendencias'
import type { ProgramTask, Goal90, Habit } from '@/types'

function habit(over: Partial<Habit> & { done?: boolean } = {}) {
  const { done, ...rest } = over
  const h: Habit = {
    id: rest.id ?? 'h1',
    user_id: 'u',
    name: rest.name ?? 'Hábito',
    area: rest.area ?? 'corpo',
    xp_reward: 0,
    time_window: null,
    active: rest.active ?? true,
    created_at: '2026-01-01',
    source: 'manual',
    difficulty: 2,
    catalog_key: null,
    days: rest.days ?? null,
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
    area: 'carreira',
    difficulty: 2,
    xp_reward: 0,
    status: over.status ?? 'pending',
    source: 'generated',
    completed_at: null,
    created_at: '2026-06-24',
    ...over,
  }
}

function goal(over: Partial<Goal90> = {}): Goal90 {
  return {
    id: over.id ?? 'g1',
    user_id: 'u',
    title: over.title ?? 'Poupar',
    area: 'financas',
    start_date: '2026-06-01',
    end_date: '2026-09-01',
    progress: over.progress ?? 0,
    status: over.status ?? 'active',
    created_at: over.created_at ?? '2026-06-01',
    ...over,
  }
}

function input(over: Partial<PendenciaInput> = {}): PendenciaInput {
  return {
    hour: 21,
    habits: [],
    hasCheckinToday: false,
    streakCurrent: 0,
    overdueTasks: [],
    goals: [],
    todayISO: '2026-06-25',
    uncategorizedTx: 0,
    ...over,
  }
}

describe('detectPendencias', () => {
  it('entrada limpa → sem pendências', () => {
    expect(detectPendencias(input())).toEqual([])
  })

  it('streak em risco só dispara à noite (>= 20h) sem atividade', () => {
    const base = { streakCurrent: 5, hasCheckinToday: false, habits: [habit({ done: false })] }
    expect(detectPendencias(input({ ...base, hour: 19 })).some((p) => p.id === 'streak-risco')).toBe(false)
    const late = detectPendencias(input({ ...base, hour: 20 }))
    expect(late.some((p) => p.id === 'streak-risco' && p.severity === 'risk')).toBe(true)
  })

  it('streak não está em risco se já houve check-in hoje', () => {
    const p = detectPendencias(input({ streakCurrent: 5, hasCheckinToday: true, hour: 22 }))
    expect(p.some((x) => x.id === 'streak-risco')).toBe(false)
  })

  it('hábitos pendentes geram warn a partir das 18h', () => {
    const p = detectPendencias(input({ hour: 18, habits: [habit({ done: false })] }))
    const warn = p.find((x) => x.id === 'habitos-pendentes')
    expect(warn?.severity).toBe('warn')
    expect(warn?.ctaHref).toBe('/habitos')
  })

  it('tarefas atrasadas detetadas', () => {
    const p = detectPendencias(input({ hour: 10, overdueTasks: [task(), task({ id: 't2' })] }))
    expect(p.find((x) => x.id === 'tarefas-atrasadas')?.message).toContain('2')
  })

  it('objetivo sem progresso há >= 7 dias gera info', () => {
    const p = detectPendencias(
      input({ hour: 10, goals: [goal({ created_at: '2026-06-01', progress: 0 })] }),
    )
    expect(p.some((x) => x.id.startsWith('objetivo-parado'))).toBe(true)
  })

  it('objetivo recente OU com progresso não gera info', () => {
    const recente = detectPendencias(input({ hour: 10, goals: [goal({ created_at: '2026-06-24' })] }))
    expect(recente.some((x) => x.id.startsWith('objetivo-parado'))).toBe(false)
    const comProgresso = detectPendencias(
      input({ hour: 10, goals: [goal({ created_at: '2026-06-01', progress: 30 })] }),
    )
    expect(comProgresso.some((x) => x.id.startsWith('objetivo-parado'))).toBe(false)
  })

  it('transações por categorizar geram info com CTA para /financas', () => {
    const p = detectPendencias(input({ hour: 10, uncategorizedTx: 3 }))
    const tx = p.find((x) => x.id === 'transacoes-por-categorizar')
    expect(tx?.ctaHref).toBe('/financas')
    expect(tx?.message).toContain('3')
  })

  it('ordena por severidade (risk → warn → info)', () => {
    const p = detectPendencias(
      input({
        hour: 21,
        streakCurrent: 5,
        hasCheckinToday: false,
        habits: [habit({ done: false })],
        uncategorizedTx: 1,
      }),
    )
    const sev = p.map((x) => x.severity)
    expect(sev[0]).toBe('risk')
    expect(sev[sev.length - 1]).toBe('info')
  })
})
