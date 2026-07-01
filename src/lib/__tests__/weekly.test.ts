import { describe, it, expect } from 'vitest'
import {
  completedByDay,
  checkinsByDay,
  completionRate,
  averageCheckin,
  activityCount,
  type WeekLog,
  type WeekCheckin,
} from '@/lib/weekly'

const logs: WeekLog[] = [
  { date: '2026-06-01', completed: true },
  { date: '2026-06-01', completed: true },
  { date: '2026-06-01', completed: false },
  { date: '2026-06-02', completed: true },
]

describe('completedByDay', () => {
  it('conta apenas os concluídos por dia', () => {
    expect(completedByDay(logs)).toEqual({ '2026-06-01': 2, '2026-06-02': 1 })
  })
})

describe('checkinsByDay', () => {
  it('conta check-ins por dia', () => {
    const ci: WeekCheckin[] = [
      { date: '2026-06-01' }, { date: '2026-06-01' }, { date: '2026-06-03' },
    ]
    expect(checkinsByDay(ci)).toEqual({ '2026-06-01': 2, '2026-06-03': 1 })
  })
})

describe('completionRate', () => {
  it('é concluídos / registados, arredondado', () => {
    expect(completionRate(logs)).toBe(75) // 3 de 4
  })
  it('devolve 0 sem registos (sem divisão por zero)', () => {
    expect(completionRate([])).toBe(0)
  })
})

describe('averageCheckin', () => {
  it('ignora null/undefined mas conta o 0 como valor legítimo', () => {
    const ci: WeekCheckin[] = [
      { date: 'a', energy: 8 },
      { date: 'b', energy: 0 },
      { date: 'c', energy: null },
      { date: 'd' },
    ]
    // média de [8, 0] = 4, não 8 — o 0 entra, o null/undefined não
    expect(averageCheckin(ci, 'energy')).toBe(4)
  })
  it('devolve 0 quando não há valores', () => {
    expect(averageCheckin([{ date: 'a' }], 'sleep_hours')).toBe(0)
  })
  it('arredonda a 1 casa decimal', () => {
    const ci: WeekCheckin[] = [
      { date: 'a', sleep_hours: 7 },
      { date: 'b', sleep_hours: 8 },
      { date: 'c', sleep_hours: 8 },
    ]
    expect(averageCheckin(ci, 'sleep_hours')).toBe(7.7)
  })
})

describe('activityCount', () => {
  it('soma conclusões de hábito + check-ins', () => {
    const ci: WeekCheckin[] = [{ date: 'a' }, { date: 'b' }]
    expect(activityCount(logs, ci)).toBe(3 + 2)
  })
})
