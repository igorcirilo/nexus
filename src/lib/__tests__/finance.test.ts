import { describe, it, expect } from 'vitest'
import {
  sumInRange,
  monthlySavings,
  categoryTotals,
  buildBudgetSummary,
  type FinTx,
} from '@/lib/finance'

const txs: FinTx[] = [
  { date: '2026-01-05', type: 'entrada', amount: 1000, category: 'Salário' },
  { date: '2026-01-10', type: 'saida', amount: 200, category: 'Alimentação' },
  { date: '2026-01-20', type: 'saida', amount: 50, category: 'Alimentação' },
  { date: '2026-01-25', type: 'saida', amount: 100, category: 'Transporte' },
  { date: '2026-02-03', type: 'entrada', amount: 800, category: 'Salário' },
  { date: '2026-02-08', type: 'saida', amount: 300, category: 'Alimentação' },
]

describe('sumInRange', () => {
  it('soma apenas o tipo e o intervalo pedidos (inclusivo)', () => {
    expect(sumInRange(txs, 'saida', '2026-01-01', '2026-01-31')).toBe(350)
    expect(sumInRange(txs, 'entrada', '2026-01-01', '2026-01-31')).toBe(1000)
  })
  it('inclui as datas de fronteira', () => {
    expect(sumInRange(txs, 'entrada', '2026-01-05', '2026-01-05')).toBe(1000)
  })
  it('devolve 0 quando não há nada no intervalo', () => {
    expect(sumInRange(txs, 'saida', '2025-12-01', '2025-12-31')).toBe(0)
  })
})

describe('monthlySavings', () => {
  it('calcula entradas, saídas e poupança por intervalo', () => {
    const series = monthlySavings(txs, [
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-02-01', end: '2026-02-28' },
    ])
    expect(series[0]).toEqual({ entradas: 1000, saidas: 350, poupanca: 650 })
    expect(series[1]).toEqual({ entradas: 800, saidas: 300, poupanca: 500 })
  })
  it('poupança fica negativa quando as saídas superam as entradas', () => {
    const [m] = monthlySavings(
      [{ date: '2026-03-02', type: 'saida', amount: 500, category: 'x' }],
      [{ start: '2026-03-01', end: '2026-03-31' }],
    )
    expect(m.poupanca).toBe(-500)
  })
})

describe('categoryTotals', () => {
  it('agrupa saídas por categoria no intervalo', () => {
    expect(categoryTotals(txs, '2026-01-01', '2026-01-31')).toEqual({
      Alimentação: 250,
      Transporte: 100,
    })
  })
  it('ignora entradas', () => {
    expect(categoryTotals(txs, '2026-01-01', '2026-01-31')).not.toHaveProperty('Salário')
  })
})

describe('buildBudgetSummary', () => {
  const budgets = { Alimentação: 200, Transporte: 200, Lazer: 0 }
  const spent = { Alimentação: 250, Transporte: 100 }
  const outCats = ['Alimentação', 'Transporte', 'Lazer']

  it('inclui só categorias com orçamento > 0, ordenadas por % desc', () => {
    const s = buildBudgetSummary(budgets, spent, outCats)
    expect(s.rows.map((r) => r.cat)).toEqual(['Alimentação', 'Transporte'])
    expect(s.rows[0].pct).toBe(125)
    expect(s.rows[1].pct).toBe(50)
  })

  it('lista as categorias sem orçamento em separado', () => {
    const s = buildBudgetSummary(budgets, spent, outCats)
    expect(s.unbudgeted).toEqual(['Lazer'])
  })

  it('agrega totais e satura o gauge em 100%', () => {
    const s = buildBudgetSummary(budgets, spent, outCats)
    expect(s.totalBudget).toBe(400)
    expect(s.totalSpent).toBe(350)
    expect(s.pct).toBe(88) // 350/400 = 87.5 → 88
  })

  it('não divide por zero sem orçamentos', () => {
    expect(buildBudgetSummary({}, spent, outCats).pct).toBe(0)
  })
})
