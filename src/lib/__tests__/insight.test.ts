import { describe, it, expect } from 'vitest'
import { pickInsight, type InsightAggregates } from '@/lib/insight'

function base(over: Partial<InsightAggregates> = {}): InsightAggregates {
  return {
    completionsByArea: {},
    totalCompletions7d: 0,
    streak: 0,
    weightDelta: null,
    weightTowardGoal: false,
    ...over,
  }
}

describe('lib/insight · O Nexus reparou', () => {
  it('prioriza progresso de peso rumo ao objetivo', () => {
    const i = pickInsight(base({ weightTowardGoal: true, weightDelta: -0.8 }))
    expect(i?.title).toContain('peso-alvo')
  })

  it('reforça série longa', () => {
    const i = pickInsight(base({ streak: 14 }))
    expect(i?.title).toContain('14 dias')
  })

  it('destaca a área mais forte da semana', () => {
    const i = pickInsight(base({ completionsByArea: { corpo: 4, idiomas: 1 }, totalCompletions7d: 5 }))
    expect(i?.title).toContain('Corpo')
  })

  it('devolve null sem sinal forte', () => {
    expect(pickInsight(base({ totalCompletions7d: 2, completionsByArea: { corpo: 2 } }))).toBeNull()
  })
})
