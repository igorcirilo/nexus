import { describe, it, expect } from 'vitest'
import { computeRitmo, dayScore, RITMO_WINDOW_DAYS, type RitmoDay } from '@/lib/ritmo'

function fill(n: number, day: RitmoDay): RitmoDay[] {
  return Array.from({ length: n }, () => ({ ...day }))
}

describe('dayScore', () => {
  it('é 1 quando todos os hábitos foram feitos e houve check-in', () => {
    expect(dayScore({ habitsTotal: 3, habitsDone: 3, checkin: true })).toBe(1)
  })

  it('combina rácio de hábitos (0.7) com check-in (0.3)', () => {
    expect(dayScore({ habitsTotal: 2, habitsDone: 1, checkin: false })).toBeCloseTo(0.35)
    expect(dayScore({ habitsTotal: 2, habitsDone: 1, checkin: true })).toBeCloseTo(0.65)
  })

  it('sem hábitos, o check-in sustenta o dia sozinho', () => {
    expect(dayScore({ habitsTotal: 0, habitsDone: 0, checkin: true })).toBe(1)
    expect(dayScore({ habitsTotal: 0, habitsDone: 0, checkin: false })).toBe(0)
  })

  it('limita o rácio a 1 mesmo com mais conclusões que hábitos ativos', () => {
    expect(dayScore({ habitsTotal: 2, habitsDone: 5, checkin: true })).toBe(1)
  })
})

describe('computeRitmo', () => {
  it('é 0 sem qualquer atividade', () => {
    expect(computeRitmo(fill(14, { habitsTotal: 3, habitsDone: 0, checkin: false }))).toBe(0)
  })

  it('é 100 com janela cheia de dias perfeitos', () => {
    expect(computeRitmo(fill(14, { habitsTotal: 3, habitsDone: 3, checkin: true }))).toBe(100)
  })

  it('é 0 sem dias', () => {
    expect(computeRitmo([])).toBe(0)
  })

  it('decai quando os dias recentes ficam vazios', () => {
    const perfeito: RitmoDay = { habitsTotal: 3, habitsDone: 3, checkin: true }
    const vazio: RitmoDay = { habitsTotal: 3, habitsDone: 0, checkin: false }
    // 3 dias recentes parados, restantes perfeitos
    const days = [...fill(3, vazio), ...fill(11, perfeito)]
    const ritmo = computeRitmo(days)
    expect(ritmo).toBeLessThan(100)
    expect(ritmo).toBeGreaterThan(0)
  })

  it('dá mais peso aos dias recentes que aos antigos', () => {
    const perfeito: RitmoDay = { habitsTotal: 3, habitsDone: 3, checkin: true }
    const vazio: RitmoDay = { habitsTotal: 3, habitsDone: 0, checkin: false }
    const recente = computeRitmo([perfeito, ...fill(13, vazio)])
    const antigo = computeRitmo([...fill(13, vazio), perfeito])
    expect(recente).toBeGreaterThan(antigo)
  })

  it('considera apenas a janela de RITMO_WINDOW_DAYS dias', () => {
    const perfeito: RitmoDay = { habitsTotal: 1, habitsDone: 1, checkin: true }
    const vazio: RitmoDay = { habitsTotal: 1, habitsDone: 0, checkin: false }
    // Dias para além da janela não devem influenciar
    const dentro = computeRitmo(fill(RITMO_WINDOW_DAYS, perfeito))
    const comExtra = computeRitmo([...fill(RITMO_WINDOW_DAYS, perfeito), ...fill(10, vazio)])
    expect(comExtra).toBe(dentro)
  })
})
