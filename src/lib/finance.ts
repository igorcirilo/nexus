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

/**
 * Projeção do balanço no fim do mês: entradas já recebidas menos as saídas
 * extrapoladas linearmente pelo ritmo diário. Devolve null nos primeiros dias
 * do mês (amostra demasiado pequena) ou sem qualquer movimento.
 */
export function projectEndOfMonth(
  totalIn: number,
  totalOut: number,
  dayOfMonth: number,
  daysInMonth: number,
): number | null {
  if (dayOfMonth < 3) return null
  if (totalIn === 0 && totalOut === 0) return null
  const projectedOut = (totalOut / dayOfMonth) * daysInMonth
  return totalIn - projectedOut
}

/**
 * Gasto do mês em categorias sem orçamento definido — o que o gauge do
 * orçamento não vê. `exclude` serve para tirar categorias que não são consumo
 * (ex.: "Poupança").
 */
export function unbudgetedSpend(
  spentByCat: Record<string, number>,
  budgets: Record<string, number>,
  exclude: string[] = [],
): number {
  return Object.entries(spentByCat)
    .filter(([cat]) => (budgets[cat] ?? 0) <= 0 && !exclude.includes(cat))
    .reduce((a, [, v]) => a + v, 0)
}

export interface LoggingStreak {
  /** Dias consecutivos com pelo menos um movimento, terminando hoje ou ontem. */
  current: number
  loggedToday: boolean
}

const shiftDay = (iso: string, delta: number): string => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

/**
 * Sequência de registo: dias consecutivos (a partir de hoje, ou de ontem se
 * ainda não registou hoje) com ≥1 movimento. `dates` são as datas 'yyyy-MM-dd'
 * dos movimentos (repetições toleradas). Pura → testável.
 */
export function loggingStreak(dates: string[], today: string): LoggingStreak {
  const set = new Set(dates)
  const loggedToday = set.has(today)
  const runFrom = (start: string): number => {
    let count = 0
    let cur = start
    while (set.has(cur)) {
      count++
      cur = shiftDay(cur, -1)
    }
    return count
  }
  if (loggedToday) return { current: runFrom(today), loggedToday: true }
  const yesterday = shiftDay(today, -1)
  if (set.has(yesterday)) return { current: runFrom(yesterday), loggedToday: false }
  return { current: 0, loggedToday: false }
}

export interface MonthSummary {
  income: number
  /** Gasto real (exclui a categoria de poupança). */
  spending: number
  /** Movido para poupança (a categoria reservada). */
  saved: number
  /** income − spending (a poupança é transferência, não entra). */
  balance: number
  topCat: { cat: string; amount: number } | null
}

/** Agregados de um mês para o resumo/fecho: entradas, gasto, poupança e maior categoria. */
export function buildMonthSummary(
  txs: FinTx[],
  start: string,
  end: string,
  savingsCat = 'Poupança',
): MonthSummary {
  let income = 0
  let spending = 0
  let saved = 0
  const byCat: Record<string, number> = {}
  for (const t of txs) {
    if (t.date < start || t.date > end) continue
    if (t.type === 'entrada') { income += t.amount; continue }
    if (t.category === savingsCat) { saved += t.amount; continue }
    spending += t.amount
    byCat[t.category] = (byCat[t.category] ?? 0) + t.amount
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  return {
    income,
    spending,
    saved,
    balance: income - spending,
    topCat: top ? { cat: top[0], amount: top[1] } : null,
  }
}

export interface MonthCloseHeadline {
  icon: string
  text: string
  tone: 'positive' | 'info'
}

/**
 * A "vitória" a destacar no fecho do mês: escolhe a afirmação verdadeira mais
 * positiva comparando o mês fechado com o anterior. Pura → testável.
 */
export function monthCloseHeadline(
  cur: MonthSummary,
  prev: MonthSummary,
  fmt: (v: number) => string,
): MonthCloseHeadline {
  if (cur.saved > 0 && cur.saved >= prev.saved) {
    return { icon: '🎉', tone: 'positive', text: `Poupaste ${fmt(cur.saved)} este mês.` }
  }
  if (cur.balance > prev.balance && cur.balance > 0) {
    return { icon: '📈', tone: 'positive', text: `Sobrou-te ${fmt(cur.balance - prev.balance)} a mais do que no mês anterior.` }
  }
  if (cur.spending < prev.spending && prev.spending > 0) {
    return { icon: '💪', tone: 'positive', text: `Gastaste ${fmt(prev.spending - cur.spending)} a menos do que no mês anterior.` }
  }
  if (cur.balance >= 0) {
    return { icon: '✅', tone: 'info', text: `Fechaste o mês no positivo, com ${fmt(cur.balance)}.` }
  }
  return { icon: '📊', tone: 'info', text: `Fechaste o mês em ${fmt(cur.balance)} — o próximo é uma nova página.` }
}

export interface RecurringLike {
  id: string
  type: 'entrada' | 'saida'
  category: string
  description: string | null
  amount: number
  day_of_month: number
  active: boolean
}

/**
 * Recorrências "por resolver" no mês corrente: regras ativas cujo dia agendado
 * já chegou (day_of_month ≤ dayOfMonth), que ainda não foram lançadas este mês
 * (nenhuma transação do mês tem recurring_id igual ao id da regra) e que não
 * foram saltadas manualmente (chave `${id}:${monthKey}` em `skips`). Ordena por
 * dia agendado. Pura → testável sem BD.
 */
export function pendingRecurrences<T extends RecurringLike>(
  rules: T[],
  monthTxRecurringIds: (string | null | undefined)[],
  dayOfMonth: number,
  monthKey: string, // 'yyyy-MM'
  skips: string[] = [],
): T[] {
  const posted = new Set(monthTxRecurringIds.filter(Boolean) as string[])
  const skipped = new Set(skips)
  return rules
    .filter(
      (r) =>
        r.active &&
        r.day_of_month <= dayOfMonth &&
        !posted.has(r.id) &&
        !skipped.has(`${r.id}:${monthKey}`),
    )
    .sort((a, b) => a.day_of_month - b.day_of_month)
}

/** Total mensal das recorrências ativas de um tipo (para o painel/insights). */
export function recurringMonthlyTotal(
  rules: RecurringLike[],
  type: 'entrada' | 'saida',
): number {
  return rules.filter((r) => r.active && r.type === type).reduce((a, r) => a + r.amount, 0)
}

export interface Insight {
  id: string
  icon: string
  text: string
  tone: 'positive' | 'warning' | 'danger' | 'info'
  /** Relevância (maior = mais importante); a UI mostra o(s) do topo. */
  score: number
}

export interface InsightInput {
  /** Resultado de projectEndOfMonth (null = sem dados suficientes). */
  projectedBalance: number | null
  spentByCat: Record<string, number>
  /** Média mensal de gasto por categoria nos últimos 3 meses completos. */
  catAvg3m: Record<string, number>
  budgets: Record<string, number>
  /** Poupança líquida (entradas−saídas) do mês anterior completo. */
  savingsPrevMonth: number
  /** Poupança líquida do mês corrente até agora. */
  savingsThisMonth: number
  /** Dias desde o último movimento registado (null = sem movimentos). */
  daysSinceLastTx: number | null
  dayOfMonth: number
  daysInMonth: number
}

/**
 * Regras determinísticas que transformam os agregados do mês em orientações
 * curtas, ordenadas por relevância. Pura: recebe agregados e um formatador de
 * moeda, devolve texto pronto a mostrar.
 */
export function buildInsights(input: InsightInput, fmt: (v: number) => string): Insight[] {
  const out: Insight[] = []
  const {
    projectedBalance, spentByCat, catAvg3m, budgets,
    savingsPrevMonth, savingsThisMonth, daysSinceLastTx, dayOfMonth, daysInMonth,
  } = input

  if (projectedBalance !== null && projectedBalance < 0) {
    out.push({
      id: 'projection-negative', icon: '⚠️', tone: 'danger', score: 100,
      text: `Ao ritmo atual terminas o mês com ≈ ${fmt(projectedBalance)}. Ainda faltam ${daysInMonth - dayOfMonth} dias para inverter.`,
    })
  }

  // Orçamentos: primeiro os já ultrapassados, depois os quase (≥85%).
  const budgeted = Object.entries(budgets).filter(([, b]) => b > 0)
  const overCat = budgeted
    .map(([cat, b]) => ({ cat, over: (spentByCat[cat] ?? 0) - b }))
    .filter((c) => c.over > 0)
    .sort((a, b) => b.over - a.over)[0]
  if (overCat) {
    out.push({
      id: `budget-over-${overCat.cat}`, icon: '🚨', tone: 'danger', score: 90,
      text: `Ultrapassaste o orçamento de ${overCat.cat} em ${fmt(overCat.over)}.`,
    })
  }
  const nearCat = budgeted
    .map(([cat, b]) => ({ cat, left: b - (spentByCat[cat] ?? 0), pct: (spentByCat[cat] ?? 0) / b }))
    .filter((c) => c.pct >= 0.85 && c.left > 0)
    .sort((a, b) => b.pct - a.pct)[0]
  if (nearCat) {
    out.push({
      id: `budget-near-${nearCat.cat}`, icon: '⏳', tone: 'warning', score: 80,
      text: `Estás a ${fmt(nearCat.left)} de ultrapassar o orçamento de ${nearCat.cat}.`,
    })
  }

  // Categoria com maior desvio face à média dos últimos 3 meses (≥15% e ≥€20
  // de média, para não alarmar sobre valores insignificantes).
  const spike = Object.entries(spentByCat)
    .map(([cat, spent]) => ({ cat, spent, avg: catAvg3m[cat] ?? 0 }))
    .filter((c) => c.avg >= 20 && c.spent > c.avg * 1.15)
    .map((c) => ({ ...c, pct: Math.round((c.spent / c.avg - 1) * 100) }))
    .sort((a, b) => b.spent - b.avg - (a.spent - a.avg))[0]
  if (spike) {
    out.push({
      id: `spike-${spike.cat}`, icon: '📈', tone: 'warning', score: 70,
      text: `Gastaste +${spike.pct}% em ${spike.cat} este mês face à tua média (${fmt(spike.avg)}/mês).`,
    })
  }

  if (daysSinceLastTx !== null && daysSinceLastTx >= 5) {
    out.push({
      id: 'stale-log', icon: '✍️', tone: 'info', score: 60,
      text: `Há ${daysSinceLastTx} dias sem registos — 30 segundos põem tudo em dia.`,
    })
  }

  // Só celebra quando a poupança parcial já bate o mês anterior completo —
  // comparar mês parcial com mês cheio de outra forma seria enganador.
  if (savingsThisMonth > 0 && savingsThisMonth > savingsPrevMonth) {
    out.push({
      id: 'savings-beat', icon: '🎉', tone: 'positive', score: 50,
      text: `Já poupaste ${fmt(savingsThisMonth)} este mês — mais do que em todo o mês passado (${fmt(Math.max(0, savingsPrevMonth))}).`,
    })
  }

  if (projectedBalance !== null && projectedBalance >= 0 && dayOfMonth >= 7) {
    out.push({
      id: 'projection-positive', icon: '🌱', tone: 'positive', score: 40,
      text: `Ao ritmo atual terminas o mês com ≈ ${fmt(projectedBalance)} de saldo positivo.`,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}
