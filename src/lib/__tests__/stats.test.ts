import { describe, it, expect } from 'vitest'
import {
  heatmapLevels,
  last7Bars,
  consistencyPct,
  totalCompletions,
  lastDays,
  type ActivityStats,
} from '@/lib/stats'

const TODAY = '2026-06-27'

function stats(byDate: Record<string, number>, activeHabits = 4, windowDays = 63): ActivityStats {
  return { byDate, activeHabits, windowDays }
}

describe('lib/stats · lastDays', () => {
  it('devolve `days` chaves terminando em hoje', () => {
    const d = lastDays(7, TODAY)
    expect(d).toHaveLength(7)
    expect(d[6]).toBe('2026-06-27')
    expect(d[0]).toBe('2026-06-21')
  })
})

describe('lib/stats · heatmapLevels', () => {
  it('dia sem conclusões = nível 0; dia cheio = nível 4', () => {
    const s = stats({ '2026-06-27': 4, '2026-06-26': 0 }, 4, 7)
    const levels = heatmapLevels(s, TODAY)
    expect(levels).toHaveLength(7)
    expect(levels[6]).toBe(4) // hoje, 4/4
    expect(levels[5]).toBe(0) // ontem, 0
  })

  it('rácio intermédio dá níveis 1–3', () => {
    const s = stats({ '2026-06-27': 1, '2026-06-26': 2, '2026-06-25': 3 }, 4, 7)
    const levels = heatmapLevels(s, TODAY)
    expect(levels[6]).toBe(1) // 1/4 = .25
    expect(levels[5]).toBe(2) // 2/4 = .5
    expect(levels[4]).toBe(3) // 3/4 = .75
  })
})

describe('lib/stats · last7Bars', () => {
  it('marca o último como hoje e calcula percentagem', () => {
    const s = stats({ '2026-06-27': 2 }, 4, 7)
    const bars = last7Bars(s, TODAY)
    expect(bars).toHaveLength(7)
    expect(bars[6].isToday).toBe(true)
    expect(bars[6].label).toBe('hoje')
    expect(bars[6].pct).toBe(50) // 2/4
  })
})

describe('lib/stats · consistencyPct', () => {
  it('% de dias com atividade', () => {
    const s = stats({ '2026-06-27': 1, '2026-06-26': 1, '2026-06-25': 2 }, 4, 10)
    expect(consistencyPct(s, 10, TODAY)).toBe(30) // 3 de 10 dias
  })

  it('100% quando todos os dias têm atividade', () => {
    const byDate: Record<string, number> = {}
    for (const d of lastDays(5, TODAY)) byDate[d] = 2
    expect(consistencyPct(stats(byDate, 4, 5), 5, TODAY)).toBe(100)
  })
})

describe('lib/stats · totalCompletions', () => {
  it('soma todas as conclusões', () => {
    expect(totalCompletions(stats({ a: 3, b: 2, c: 5 }))).toBe(10)
  })
})
