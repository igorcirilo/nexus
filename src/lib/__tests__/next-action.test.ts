import { describe, it, expect } from 'vitest'
import { getNextAction, type NextActionInput } from '@/lib/next-action'

function base(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    phase: 'manha',
    checkinPending: false,
    energy: 6,
    mission: null,
    streak: 3,
    habits: [
      { id: 'a', name: 'Treino', done: false },
      { id: 'b', name: 'Ler', done: false },
    ],
    nightCheckinDone: false,
    ...overrides,
  }
}

describe('lib/next-action · condutor único', () => {
  it('prioriza o check-in da fase quando está em falta', () => {
    const a = getNextAction(base({ checkinPending: true }))
    expect(a.kind).toBe('checkin')
    expect(a.ctaLabel).toBe('Fazer check-in')
  })

  it('com energia baixa propõe só 1 hábito essencial', () => {
    const a = getNextAction(base({ energy: 2 }))
    expect(a.kind).toBe('habit')
    if (a.kind === 'habit') {
      expect(a.habitId).toBe('a')
      expect(a.title).toContain('Energia baixa')
    }
  })

  it('propõe o próximo hábito por fazer, factual', () => {
    const a = getNextAction(base())
    expect(a.kind).toBe('habit')
    if (a.kind === 'habit') {
      expect(a.habitId).toBe('a')
      expect(a.title).toContain('Treino')
    }
  })

  it('usa a missão do check-in como porquê quando existe', () => {
    const a = getNextAction(base({ mission: 'Entregar o relatório' }))
    if (a.kind === 'habit') expect(a.why).toContain('Entregar o relatório')
  })

  it('salta o primeiro hábito já concluído', () => {
    const a = getNextAction(base({ habits: [
      { id: 'a', name: 'Treino', done: true },
      { id: 'b', name: 'Ler', done: false },
    ] }))
    if (a.kind === 'habit') expect(a.habitId).toBe('b')
  })

  it('não inventa tarefas quando está tudo cumprido', () => {
    const a = getNextAction(base({ habits: [{ id: 'a', name: 'Treino', done: true }] }))
    expect(a.kind).toBe('progress')
  })

  it('energia desconhecida (0) não dispara o ramo de energia baixa', () => {
    const a = getNextAction(base({ energy: 0 }))
    expect(a.kind).toBe('habit')
    if (a.kind === 'habit') expect(a.title).toContain('A seguir')
  })
})
