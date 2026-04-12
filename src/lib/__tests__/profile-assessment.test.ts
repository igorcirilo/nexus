import { describe, it, expect } from 'vitest'
import { calculateScores } from '@/lib/profile-assessment'
import type { Answers } from '@/types'

describe('calculateScores', () => {
  it('returns scores for all 7 areas plus global', () => {
    const answers: Answers = {
      b1_corpo: 4, b1_produtividade: 3, b1_idiomas: 2, b1_carreira: 4,
      b1_financas: 3, b1_emocoes: 2, b1_relacionamentos: 5,
      b2_objetivo: 'corpo',
      b3_exercicio: '3_4x', b3_planejamento: 'quase',
      b4_travas: ['tempo', 'procrastina'], b4_estresse: 3,
      b5_autoimagem: 4,
      b6_ambiente: ['familia_apoio', 'renda_estavel'], b6_suporte: 'sim_muito',
      b7_rotina: 'manha',
      b8_prioridades: ['corpo', 'produtividade', 'emocoes'],
    }
    const scores = calculateScores(answers)
    expect(scores).toHaveProperty('corpo')
    expect(scores).toHaveProperty('produtividade')
    expect(scores).toHaveProperty('idiomas')
    expect(scores).toHaveProperty('carreira')
    expect(scores).toHaveProperty('financas')
    expect(scores).toHaveProperty('emocoes')
    expect(scores).toHaveProperty('relacionamentos')
    expect(scores).toHaveProperty('global')
  })

  it('all scores are integers between 0 and 100', () => {
    const answers: Answers = {
      b1_corpo: 5, b1_produtividade: 5, b1_idiomas: 5, b1_carreira: 5,
      b1_financas: 5, b1_emocoes: 5, b1_relacionamentos: 5,
      b2_objetivo: 'corpo',
      b3_exercicio: '5x_mais', b3_planejamento: 'sempre',
      b4_travas: [], b4_estresse: 1,
      b5_autoimagem: 5,
      b6_ambiente: ['familia_apoio', 'renda_estavel'], b6_suporte: 'sim_muito',
      b7_rotina: 'manha',
      b8_prioridades: ['corpo', 'produtividade', 'emocoes'],
    }
    const scores = calculateScores(answers)
    const areas = ['corpo', 'produtividade', 'idiomas', 'carreira', 'financas', 'emocoes', 'relacionamentos', 'global'] as const
    for (const area of areas) {
      expect(scores[area]).toBeGreaterThanOrEqual(0)
      expect(scores[area]).toBeLessThanOrEqual(100)
      expect(Number.isInteger(scores[area])).toBe(true)
    }
  })

  it('higher answers produce higher scores', () => {
    const lowAnswers: Answers = {
      b1_corpo: 1, b1_produtividade: 1, b1_idiomas: 1, b1_carreira: 1,
      b1_financas: 1, b1_emocoes: 1, b1_relacionamentos: 1,
      b2_objetivo: 'corpo',
      b3_exercicio: 'nunca', b3_planejamento: 'nunca',
      b4_travas: ['tempo', 'procrastina', 'motivacao', 'ambiente', 'social', 'financeiro'],
      b4_estresse: 5, b5_autoimagem: 1,
      b6_ambiente: [], b6_suporte: 'nao',
      b7_rotina: 'noite',
      b8_prioridades: ['corpo', 'produtividade', 'emocoes'],
    }
    const highAnswers: Answers = {
      b1_corpo: 5, b1_produtividade: 5, b1_idiomas: 5, b1_carreira: 5,
      b1_financas: 5, b1_emocoes: 5, b1_relacionamentos: 5,
      b2_objetivo: 'corpo',
      b3_exercicio: '5x_mais', b3_planejamento: 'sempre',
      b4_travas: [], b4_estresse: 1, b5_autoimagem: 5,
      b6_ambiente: ['familia_apoio', 'renda_estavel'], b6_suporte: 'sim_muito',
      b7_rotina: 'manha',
      b8_prioridades: ['corpo', 'produtividade', 'emocoes'],
    }
    const low = calculateScores(lowAnswers)
    const high = calculateScores(highAnswers)
    expect(high.global).toBeGreaterThan(low.global)
    expect(high.corpo).toBeGreaterThan(low.corpo)
    expect(high.emocoes).toBeGreaterThan(low.emocoes)
  })

  it('global is the average of area scores', () => {
    const answers: Answers = {
      b1_corpo: 3, b1_produtividade: 3, b1_idiomas: 3, b1_carreira: 3,
      b1_financas: 3, b1_emocoes: 3, b1_relacionamentos: 3,
      b2_objetivo: 'corpo',
      b3_exercicio: '3_4x', b3_planejamento: 'as_vezes',
      b4_travas: ['tempo'], b4_estresse: 3, b5_autoimagem: 3,
      b6_ambiente: ['trabalho_fixo'], b6_suporte: 'sim_pouco',
      b7_rotina: 'tarde',
      b8_prioridades: ['corpo', 'produtividade', 'emocoes'],
    }
    const scores = calculateScores(answers)
    const areas = ['corpo', 'produtividade', 'idiomas', 'carreira', 'financas', 'emocoes', 'relacionamentos'] as const
    const expectedGlobal = Math.round(areas.reduce((sum, a) => sum + scores[a], 0) / 7)
    expect(scores.global).toBe(expectedGlobal)
  })
})
