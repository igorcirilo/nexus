import { describe, it, expect } from 'vitest'
import { detectGap, GAP_THRESHOLD_DAYS, type HabitActivityRow } from '@/lib/gaps'

const TODAY = '2026-06-26'

function habit(id: string, daysOld: number, area: HabitActivityRow['area'] = 'corpo'): HabitActivityRow {
  const created = new Date(`${TODAY}T12:00:00`)
  created.setDate(created.getDate() - daysOld)
  return { id, name: `Hábito ${id}`, area, created_at: created.toISOString() }
}

function ago(days: number): string {
  const d = new Date(`${TODAY}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

describe('lib/gaps · mentor de lacuna', () => {
  it('não acusa lacuna em hábitos novos (sem idade suficiente)', () => {
    const habits = [habit('a', 2)]
    expect(detectGap(habits, [], TODAY)).toBeNull()
  })

  it('deteta hábito antigo nunca concluído como lacuna', () => {
    const habits = [habit('a', 20)]
    const gap = detectGap(habits, [], TODAY)
    expect(gap?.habitId).toBe('a')
    expect(gap?.days).toBe(20)
  })

  it('não acusa lacuna se concluído dentro do limiar', () => {
    const habits = [habit('a', 30)]
    const logs = [{ habit_id: 'a', date: ago(2) }]
    expect(detectGap(habits, logs, TODAY)).toBeNull()
  })

  it('conta os dias desde a última conclusão', () => {
    const habits = [habit('a', 30)]
    const logs = [{ habit_id: 'a', date: ago(GAP_THRESHOLD_DAYS + 3) }]
    const gap = detectGap(habits, logs, TODAY)
    expect(gap?.days).toBe(GAP_THRESHOLD_DAYS + 3)
  })

  it('escolhe a maior lacuna entre vários hábitos', () => {
    const habits = [habit('a', 30, 'corpo'), habit('b', 30, 'idiomas')]
    const logs = [
      { habit_id: 'a', date: ago(10) },
      { habit_id: 'b', date: ago(25) },
    ]
    const gap = detectGap(habits, logs, TODAY)
    expect(gap?.habitId).toBe('b')
    expect(gap?.area).toBe('idiomas')
  })
})
