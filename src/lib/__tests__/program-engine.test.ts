import { describe, it, expect } from 'vitest'
import { selectTemplatesForWeek1, shouldTaskBeOnDay, difficultyForWeek, selectTemplatesForProgram } from '@/lib/program-engine'
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

// ── difficultyForWeek ──────────────────────────────────────
describe('difficultyForWeek', () => {
  it('returns 1 for weeks 1–3', () => {
    expect(difficultyForWeek(1)).toBe(1)
    expect(difficultyForWeek(2)).toBe(1)
    expect(difficultyForWeek(3)).toBe(1)
  })

  it('returns 2 for weeks 4–6', () => {
    expect(difficultyForWeek(4)).toBe(2)
    expect(difficultyForWeek(5)).toBe(2)
    expect(difficultyForWeek(6)).toBe(2)
  })

  it('returns 3 for weeks 7–9', () => {
    expect(difficultyForWeek(7)).toBe(3)
    expect(difficultyForWeek(8)).toBe(3)
    expect(difficultyForWeek(9)).toBe(3)
  })
})

// ── selectTemplatesForProgram ──────────────────────────────
const makeTemplateWithDifficulty = (
  area: HabitArea,
  freq: number,
  id: string,
  difficulty: 1 | 2 | 3
): TaskTemplate => ({
  id,
  area,
  title: `Template ${id}`,
  description: null,
  difficulty,
  frequency_per_week: freq,
  xp_reward: 20,
  tags: [],
  active: true,
  created_at: new Date().toISOString(),
})

const mixedTemplates: TaskTemplate[] = [
  makeTemplateWithDifficulty('corpo',         7, 'd1-corpo', 1),
  makeTemplateWithDifficulty('produtividade', 7, 'd1-prod',  1),
  makeTemplateWithDifficulty('financas',      7, 'd1-fin',   1),
  makeTemplateWithDifficulty('corpo',         5, 'd2-corpo', 2),
  makeTemplateWithDifficulty('produtividade', 5, 'd2-prod',  2),
  makeTemplateWithDifficulty('financas',      5, 'd2-fin',   2),
  makeTemplateWithDifficulty('corpo',         4, 'd3-corpo', 3),
  makeTemplateWithDifficulty('produtividade', 5, 'd3-prod',  3),
  makeTemplateWithDifficulty('financas',      1, 'd3-fin',   3),
]

describe('selectTemplatesForProgram', () => {
  it('returns only difficulty 1 templates for week 1', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.every(t => t.difficulty === 1)).toBe(true)
  })

  it('returns only difficulty 2 templates for week 4', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 4)
    expect(selected.every(t => t.difficulty === 2)).toBe(true)
  })

  it('returns only difficulty 3 templates for week 7', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 7)
    expect(selected.every(t => t.difficulty === 3)).toBe(true)
  })

  it('returns at most 3 templates', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.length).toBeLessThanOrEqual(3)
  })

  it('includes template from lowest scoring area when available', () => {
    // baseScores: financas=50 é o menor
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.some(t => t.area === 'financas')).toBe(true)
  })

  it('falls back to difficulty 1 when no templates exist for requested difficulty', () => {
    const diff1Only = mixedTemplates.filter(t => t.difficulty === 1)
    const selected = selectTemplatesForProgram(diff1Only, baseScores, 'corpo', 4)
    expect(selected.every(t => t.difficulty === 1)).toBe(true)
    expect(selected.length).toBeGreaterThan(0)
  })

  it('does not return duplicates', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    const ids = selected.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
