import { describe, it, expect } from 'vitest'
import { selectTemplatesForWeek1, shouldTaskBeOnDay } from '@/lib/program-engine'
import type { TaskTemplate, AreaScores, HabitArea } from '@/types'

const makeTemplate = (area: HabitArea, freq: number, id: string): TaskTemplate => ({
  id,
  area,
  title: `Template ${id}`,
  description: null,
  difficulty: 1,
  frequency_per_week: freq,
  xp_reward: 20,
  tags: [],
  active: true,
  created_at: new Date().toISOString(),
})

const baseScores: AreaScores = {
  corpo: 60, produtividade: 70, idiomas: 80, carreira: 75,
  financas: 50, emocoes: 65, relacionamentos: 55, global: 65,
}

const templates: TaskTemplate[] = [
  makeTemplate('corpo', 7, 't1'),
  makeTemplate('produtividade', 7, 't2'),
  makeTemplate('emocoes', 7, 't3'),
  makeTemplate('idiomas', 5, 't4'),
  makeTemplate('carreira', 5, 't5'),
  makeTemplate('financas', 7, 't6'),
  makeTemplate('relacionamentos', 3, 't7'),
]

describe('selectTemplatesForWeek1', () => {
  it('returns exactly 3 templates', () => {
    const selected = selectTemplatesForWeek1(templates, baseScores, 'corpo')
    expect(selected).toHaveLength(3)
  })

  it('includes at least 1 template from the priority area', () => {
    const selected = selectTemplatesForWeek1(templates, baseScores, 'corpo')
    expect(selected.some(t => t.area === 'corpo')).toBe(true)
  })

  it('includes at least 1 template from the lowest scoring area', () => {
    const selected = selectTemplatesForWeek1(templates, baseScores, 'corpo')
    expect(selected.some(t => t.area === 'financas')).toBe(true)
  })

  it('only returns difficulty 1 templates', () => {
    const withHardTemplate = [
      ...templates,
      { ...makeTemplate('corpo', 7, 'hard'), difficulty: 2 as const },
    ]
    const selected = selectTemplatesForWeek1(withHardTemplate, baseScores, 'corpo')
    expect(selected.every(t => t.difficulty === 1)).toBe(true)
  })

  it('does not return duplicates', () => {
    const selected = selectTemplatesForWeek1(templates, baseScores, 'corpo')
    const ids = selected.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('shouldTaskBeOnDay', () => {
  it('freq 7 includes all days', () => {
    for (let d = 0; d < 7; d++) {
      expect(shouldTaskBeOnDay(7, d)).toBe(true)
    }
  })

  it('freq 5 includes Mon-Fri (0-4)', () => {
    expect(shouldTaskBeOnDay(5, 0)).toBe(true)
    expect(shouldTaskBeOnDay(5, 4)).toBe(true)
    expect(shouldTaskBeOnDay(5, 5)).toBe(false)
    expect(shouldTaskBeOnDay(5, 6)).toBe(false)
  })

  it('freq 3 includes Mon, Wed, Fri (0, 2, 4)', () => {
    expect(shouldTaskBeOnDay(3, 0)).toBe(true)
    expect(shouldTaskBeOnDay(3, 2)).toBe(true)
    expect(shouldTaskBeOnDay(3, 4)).toBe(true)
    expect(shouldTaskBeOnDay(3, 1)).toBe(false)
    expect(shouldTaskBeOnDay(3, 3)).toBe(false)
  })
})
