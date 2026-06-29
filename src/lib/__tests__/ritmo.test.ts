import { describe, it, expect } from 'vitest'
import { computeRitmo, dayScore, buildRitmoDays, RITMO_WINDOW_DAYS, type RitmoDay } from '@/lib/ritmo'

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

describe('buildRitmoDays — denominador por dia', () => {
  it('usa o nº de hábitos devidos em cada data, não um total fixo', () => {
    const now = new Date('2026-06-29T12:00:00') // segunda-feira
    // 5 hábitos em dias úteis (seg–sex), 0 ao fim de semana.
    const dueOn = (d: Date) => (d.getDay() === 0 || d.getDay() === 6 ? 0 : 5)
    const days = buildRitmoDays(now, dueOn, {}, new Set())

    expect(days[0].habitsTotal).toBe(5) // hoje = segunda
    const weekend = days.find((_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - i)
      return d.getDay() === 0 || d.getDay() === 6
    })
    expect(weekend?.habitsTotal).toBe(0)
  })

  it('o número fixo continua a funcionar (retrocompatível)', () => {
    const days = buildRitmoDays(new Date('2026-06-29T12:00:00'), 3, {}, new Set())
    expect(days.every((d) => d.habitsTotal === 3)).toBe(true)
  })
})
