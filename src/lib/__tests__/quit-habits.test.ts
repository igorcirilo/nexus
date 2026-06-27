import { describe, it, expect } from 'vitest'
import { daysClean, nextMilestone, MILESTONES } from '@/lib/quit-habits'

/**
 * Lógica central do modo "Largar" — testável sem BD.
 * daysClean usa parseLocalDate (âncora ao meio-dia local), por isso é estável
 * quanto a fuso e a horas de verão.
 */
describe('lib/quit-habits · daysClean', () => {
  it('mesmo dia = 0 dias limpo', () => {
    expect(daysClean('2026-06-27', '2026-06-27')).toBe(0)
  })

  it('um dia depois = 1', () => {
    expect(daysClean('2026-06-26', '2026-06-27')).toBe(1)
  })

  it('uma semana = 7', () => {
    expect(daysClean('2026-06-20', '2026-06-27')).toBe(7)
  })

  it('atravessa mês corretamente', () => {
    expect(daysClean('2026-05-28', '2026-06-04')).toBe(7)
  })

  it('nunca devolve negativo (quit_date no futuro)', () => {
    expect(daysClean('2026-06-30', '2026-06-27')).toBe(0)
  })
})

describe('lib/quit-habits · nextMilestone', () => {
  it('0 dias → primeiro marco (1)', () => {
    expect(nextMilestone(0)).toBe(1)
  })

  it('entre marcos devolve o seguinte', () => {
    expect(nextMilestone(5)).toBe(7)
    expect(nextMilestone(7)).toBe(14)
    expect(nextMilestone(45)).toBe(60)
  })

  it('depois do último marco → null', () => {
    expect(nextMilestone(365)).toBeNull()
    expect(nextMilestone(500)).toBeNull()
  })

  it('marcos estão ordenados crescentemente', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i]).toBeGreaterThan(MILESTONES[i - 1])
    }
  })
})
