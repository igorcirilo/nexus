// src/lib/finance.ts
//
// Derivações puras das finanças, extraídas da página /financas para poderem ser
// testadas sem BD nem React. A página continua a orquestrar fetch + estado; aqui
// vivem só os cálculos (somatórios, série mensal e resumo de orçamento).

export interface FinTx {
  date: string // 'yyyy-MM-dd'
  type: 'entrada' | 'saida'
  amount: number
  category: string
}

export interface DateRange {
  start: string // 'yyyy-MM-dd' inclusivo
  end: string   // 'yyyy-MM-dd' inclusivo
}

/** Soma dos montantes de um tipo dentro de um intervalo de datas (inclusivo). */
export function sumInRange(
  txs: FinTx[],
  type: 'entrada' | 'saida',
  start: string,
  end: string,
): number {
  return txs
    .filter((t) => t.type === type && t.date >= start && t.date <= end)
    .reduce((a, t) => a + t.amount, 0)
}

/** Série entradas/saídas/poupança por intervalo (ex.: um por mês), arredondada. */
export function monthlySavings(
  txs: FinTx[],
  ranges: DateRange[],
): { entradas: number; saidas: number; poupanca: number }[] {
  return ranges.map(({ start, end }) => {
    const entradas = sumInRange(txs, 'entrada', start, end)
    const saidas = sumInRange(txs, 'saida', start, end)
    return {
      entradas: Math.round(entradas),
      saidas: Math.round(saidas),
      poupanca: Math.round(entradas - saidas),
    }
  })
}

/** Total de saídas por categoria dentro de um intervalo (inclusivo). */
export function categoryTotals(
  txs: FinTx[],
  start: string,
  end: string,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const t of txs) {
    if (t.type === 'saida' && t.date >= start && t.date <= end) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
  }
  return map
}

export interface BudgetRow {
  cat: string
  budget: number
  spent: number
  pct: number
}

export interface BudgetSummary {
  rows: BudgetRow[]
  unbudgeted: string[]
  totalBudget: number
  totalSpent: number
  /** % do total gasto face ao total orçado (0–100, saturada). */
  pct: number
}

/**
 * Resumo de orçamento: categorias com orçamento > 0 (ordenadas por % gasto,
 * desc), categorias sem orçamento, e os totais/gauge. `spentByCat` costuma vir
 * de `categoryTotals` do mês atual.
 */
export function buildBudgetSummary(
  budgets: Record<string, number>,
  spentByCat: Record<string, number>,
  outCats: string[],
): BudgetSummary {
  const rows = outCats
    .filter((c) => (budgets[c] ?? 0) > 0)
    .map((c) => {
      const budget = budgets[c]
      const spent = spentByCat[c] ?? 0
      return { cat: c, budget, spent, pct: Math.round((spent / budget) * 100) }
    })
    .sort((a, b) => b.pct - a.pct)
  const unbudgeted = outCats.filter((c) => (budgets[c] ?? 0) <= 0)
  const totalBudget = rows.reduce((a, b) => a + b.budget, 0)
  const totalSpent = rows.reduce((a, b) => a + b.spent, 0)
  const pct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  return { rows, unbudgeted, totalBudget, totalSpent, pct }
}
