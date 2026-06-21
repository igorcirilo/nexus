import { describe, it, expect } from 'vitest'
import { suggestHabitLevel, selectHabitsForLevel, getLevelSpec, HABIT_LEVELS } from '@/lib/assessment-to-habits'
import type { Answers, AreaScores, HabitArea } from '@/types'

const AREAS: HabitArea[] = ['corpo', 'produtividade', 'idiomas', 'carreira', 'financas', 'emocoes', 'relacionamentos']

function scores(global: number, overrides: Partial<Record<HabitArea, number>> = {}): AreaScores {
  const base = Object.fromEntries(AREAS.map((a) => [a, 50])) as Record<HabitArea, number>
  return { ...base, ...overrides, global } as AreaScores
}

describe('suggestHabitLevel', () => {
  it('3+ barreiras puxam para o nível 1', () => {
    const answers: Answers = { b5_autoimagem: 3, b4_travas: ['procrastina', 'tempo', 'motivacao'] }
    expect(suggestHabitLevel(answers, scores(50))).toBe(1)
  })

  it('sinais fortes → nível 4', () => {
    const answers: Answers = {
      b5_autoimagem: 5,
      b4_travas: [],
      b3_exercicio: '5x_mais',
      b3_planejamento: 'sempre',
    }
    expect(suggestHabitLevel(answers, scores(75))).toBe(4)
  })

  it('default conservador (poucos sinais) fica baixo', () => {
    const level = suggestHabitLevel({ b5_autoimagem: 3 }, scores(50))
    expect(level).toBeLessThanOrEqual(2)
  })
})

describe('selectHabitsForLevel', () => {
  const baseAnswers: Answers = { b2_objetivo: 'financas', b4_travas: [], b7_rotina: 'manha' }

  it('devolve exatamente o total do nível', () => {
    for (const spec of HABIT_LEVELS) {
      const picked = selectHabitsForLevel(baseAnswers, scores(50), spec.level)
      expect(picked.length).toBe(spec.total)
    }
  })

  it('garante pelo menos 3 hábitos fáceis', () => {
    for (const spec of HABIT_LEVELS) {
      const picked = selectHabitsForLevel(baseAnswers, scores(50), spec.level)
      expect(picked.filter((h) => h.difficulty === 1).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('inclui um hábito da área prioritária', () => {
    const picked = selectHabitsForLevel(baseAnswers, scores(50), 4)
    expect(picked.some((h) => h.area === 'financas')).toBe(true)
  })

  it('injeta hábito anti-procrastinação quando b4_travas tem procrastina', () => {
    const answers: Answers = { ...baseAnswers, b4_travas: ['procrastina'] }
    const picked = selectHabitsForLevel(answers, scores(50), 1)
    expect(picked.some((h) => h.key === 'barr_2min')).toBe(true)
  })

  it('sem catalog_key duplicado', () => {
    const picked = selectHabitsForLevel(baseAnswers, scores(50), 4)
    const keys = picked.map((h) => h.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('aplica a janela de pico (b7_rotina) aos hábitos flexíveis', () => {
    const answers: Answers = { ...baseAnswers, b7_rotina: 'noite' }
    const picked = selectHabitsForLevel(answers, scores(50), 4)
    // pelo menos um hábito flexível deve ter recebido a janela "Noite"
    expect(picked.some((h) => h.time_window === 'Noite')).toBe(true)
  })
})

describe('getLevelSpec', () => {
  it('mapeia níveis conhecidos', () => {
    expect(getLevelSpec(1).total).toBe(3)
    expect(getLevelSpec(4).total).toBe(8)
  })
})
