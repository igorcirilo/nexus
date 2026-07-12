import { describe, it, expect } from 'vitest'
import { suggestMilestones } from '@/lib/goal-milestones'

describe('suggestMilestones', () => {
  it('janela de 90 dias gera os 5 checkpoints + conclusão, com datas certas', () => {
    const ms = suggestMilestones('2026-07-01', '2026-09-29')
    expect(ms).toHaveLength(6)
    expect(ms.map((m) => m.due_date)).toEqual([
      '2026-07-04', // +3
      '2026-07-08', // +7
      '2026-07-22', // +21
      '2026-08-15', // +45
      '2026-09-05', // +66
      '2026-09-29', // fim
    ])
    expect(ms[ms.length - 1].title).toBe('Conclusão do objetivo')
  })

  it('janela de 30 dias só inclui os checkpoints que cabem (3, 7, 21) + conclusão', () => {
    const ms = suggestMilestones('2026-07-01', '2026-07-31')
    expect(ms.map((m) => m.title)).toEqual([
      'Arranque: 3 primeiros dias',
      'Primeira semana completa',
      '21 dias — consolidação',
      'Conclusão do objetivo',
    ])
    expect(ms[ms.length - 1].due_date).toBe('2026-07-31')
  })

  it('checkpoint que coincidiria com o fim não duplica a conclusão', () => {
    // Janela de exatamente 21 dias: o marco de 21 não entra (offset < janela).
    const ms = suggestMilestones('2026-07-01', '2026-07-22')
    expect(ms.map((m) => m.title)).toEqual([
      'Arranque: 3 primeiros dias',
      'Primeira semana completa',
      'Conclusão do objetivo',
    ])
  })

  it('janela muito curta gera só a conclusão', () => {
    const ms = suggestMilestones('2026-07-01', '2026-07-03')
    expect(ms.map((m) => m.title)).toEqual(['Conclusão do objetivo'])
  })

  it('janela invertida ou nula não gera marcos', () => {
    expect(suggestMilestones('2026-07-10', '2026-07-10')).toEqual([])
    expect(suggestMilestones('2026-07-10', '2026-07-01')).toEqual([])
  })
})
