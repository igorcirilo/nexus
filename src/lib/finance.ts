// src/lib/finance.ts
//
// Derivações puras das finanças, extraídas da página /financas para poderem ser
// testadas sem BD nem React. A página continua a orquestrar fetch + estado; aqui
// vivem só os cálculos (somatórios, série mensal e resumo de orçamento).

import { EMERGENCY_CAT, INVEST_CAT } from '@/lib/categories'

export interface FinTx {
  date: string // 'yyyy-MM-dd'
  type: 'entrada' | 'saida'
  amount: number
  category: string
  /** Despesa paga pela reserva ("paga-te primeiro"): sai da reserva, aparece
   *  nos gastos, mas não mexe no balanço/conta corrente. Só faz sentido em
   *  saídas de categoria ≠ Poupança. */
  from_reserve?: boolean
}

export interface DateRange {
  start: string // 'yyyy-MM-dd' inclusivo
  end: string   // 'yyyy-MM-dd' inclusivo
}

/**
 * Tipo efetivo de um movimento no modelo "paga-te primeiro". A categoria de
 * poupança é uma transferência conta↔reserva; uma saída normal é despesa; uma
 * saída marcada `from_reserve` é dinheiro que se gasta a partir da reserva.
 *
 * As categorias de aporte ("Emergências", "Investimentos") também são
 * transferências, mas lidas do ponto de vista da CONTA (o inverso da convenção
 * legada de "Poupança"): saída = aporte (o dinheiro sai da conta para o pote),
 * entrada = resgate (volta do pote à conta). "Emergências" mexe na reserva;
 * "Investimentos" só conta no "poupado" do mês.
 */
export type TxKind =
  | 'receita' | 'despesa' | 'deposito' | 'levantamento' | 'gastoReserva'
  | 'aporteReserva' | 'resgateReserva' | 'aporteInvest' | 'resgateInvest'

export function txKind(
  t: Pick<FinTx, 'type' | 'category' | 'from_reserve'>,
  savingsCat = 'Poupança',
): TxKind {
  if (t.category === savingsCat) return t.type === 'entrada' ? 'deposito' : 'levantamento'
  if (t.category === EMERGENCY_CAT) return t.type === 'saida' ? 'aporteReserva' : 'resgateReserva'
  if (t.category === INVEST_CAT) return t.type === 'saida' ? 'aporteInvest' : 'resgateInvest'
  if (t.type === 'entrada') return 'receita'
  return t.from_reserve ? 'gastoReserva' : 'despesa'
}

/**
 * Fluxo sobre a CONTA CORRENTE (define o balanço do mês, no modelo paga-te
 * primeiro): receita soma, despesa subtrai, depósito subtrai (poupar é pagar-se
 * a si mesmo), levantamento devolve, gasto da reserva não toca na conta (o
 * dinheiro já saiu da conta quando foi poupado). Pura → testável.
 */
export function cashFlow(t: FinTx, savingsCat = 'Poupança'): number {
  switch (txKind(t, savingsCat)) {
    case 'receita':        return t.amount
    case 'despesa':        return -t.amount
    case 'deposito':       return -t.amount
    case 'levantamento':   return t.amount
    case 'gastoReserva':   return 0
    case 'aporteReserva':  return -t.amount
    case 'aporteInvest':   return -t.amount
    case 'resgateReserva': return t.amount
    case 'resgateInvest':  return t.amount
  }
}

/**
 * Fluxo sobre a RESERVA: depósito/aporte de emergência somam, levantamento,
 * resgate e gasto da reserva subtraem; receita/despesa/investimentos não a
 * tocam. Pura → testável.
 */
export function reserveFlow(t: FinTx, savingsCat = 'Poupança'): number {
  switch (txKind(t, savingsCat)) {
    case 'deposito':       return t.amount
    case 'aporteReserva':  return t.amount
    case 'levantamento':   return -t.amount
    case 'resgateReserva': return -t.amount
    case 'gastoReserva':   return -t.amount
    default:               return 0
  }
}

/**
 * Fluxo sobre o "POUPADO" do mês (cartão 💰 Poupança, série do gráfico,
 * insights): tudo o que pagaste a ti mesmo — reserva (fluxo-reserva) mais
 * aportes/resgates de investimento. Pura → testável.
 */
export function savedFlow(t: FinTx, savingsCat = 'Poupança'): number {
  switch (txKind(t, savingsCat)) {
    case 'aporteInvest':  return t.amount
    case 'resgateInvest': return -t.amount
    default:              return reserveFlow(t, savingsCat)
  }
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

/** Variação líquida do "poupado" por intervalo (Σ `savedFlow`: reserva +
 *  investimentos), arredondada. Para a série "poupado" do gráfico de 6 meses. */
export function monthlySavedChange(
  txs: FinTx[],
  ranges: DateRange[],
  savingsCat = 'Poupança',
): number[] {
  return ranges.map(({ start, end }) =>
    Math.round(
      txs
        .filter((t) => t.date >= start && t.date <= end)
        .reduce((a, t) => a + savedFlow(t, savingsCat), 0),
    ),
  )
}

/**
 * Total de gasto por categoria dentro de um intervalo (inclusivo). Considera
 * despesas e — se `includeReserve` (default) — também os gastos pagos pela
 * reserva. Transferências (depósito/levantamento de Poupança) ficam sempre de
 * fora. O gauge de orçamento passa `includeReserve:false` (o gasto da reserva é
 * consumo excecional, não gasto mensal planeado); "para onde foi o dinheiro" e
 * as anomalias usam o default `true`.
 *
 * `includeContributions` conta também os aportes (Emergências/Investimentos)
 * na sua categoria — é o que enche os envelopes do orçamento. Fica fora dos
 * mapas de consumo (default `false`): um aporte não é gasto.
 */
export function categoryTotals(
  txs: FinTx[],
  start: string,
  end: string,
  { includeReserve = true, includeContributions = false, savingsCat = 'Poupança' }:
    { includeReserve?: boolean; includeContributions?: boolean; savingsCat?: string } = {},
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const t of txs) {
    if (t.date < start || t.date > end) continue
    const kind = txKind(t, savingsCat)
    if (
      kind === 'despesa' ||
      (includeReserve && kind === 'gastoReserva') ||
      (includeContributions && (kind === 'aporteReserva' || kind === 'aporteInvest'))
    ) {
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
  /** Conta fixa (valor previsível): atingir o orçamento é normal, não avisa. */
  fixed: boolean
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
 * de `categoryTotals` do mês atual. `fixedCats` marca contas fixas (a UI usa
 * `row.fixed` para não avisar quando atingem o orçamento — é o esperado).
 */
export function buildBudgetSummary(
  budgets: Record<string, number>,
  spentByCat: Record<string, number>,
  outCats: string[],
  fixedCats: string[] = [],
): BudgetSummary {
  const fixed = new Set(fixedCats)
  const rows = outCats
    .filter((c) => (budgets[c] ?? 0) > 0)
    .map((c) => {
      const budget = budgets[c]
      const spent = spentByCat[c] ?? 0
      return { cat: c, budget, spent, pct: Math.round((spent / budget) * 100), fixed: fixed.has(c) }
    })
    .sort((a, b) => b.pct - a.pct)
  const unbudgeted = outCats.filter((c) => (budgets[c] ?? 0) <= 0)
  const totalBudget = rows.reduce((a, b) => a + b.budget, 0)
  const totalSpent = rows.reduce((a, b) => a + b.spent, 0)
  const pct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  return { rows, unbudgeted, totalBudget, totalSpent, pct }
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

/**
 * Saldo que "arrasta" para o início de um mês: o dinheiro líquido que sobrou
 * na conta corrente dos meses anteriores. É a soma do fluxo-conta (`cashFlow`)
 * de tudo antes de `beforeDate`: receitas somam, despesas e depósitos subtraem,
 * levantamentos devolvem, e o gasto da reserva não conta (saiu da reserva, não
 * da conta). Pura → testável. Limitada ao histórico carregado, por isso conta
 * a partir do primeiro movimento registado, não do saldo real.
 */
export function carryIn(txs: FinTx[], beforeDate: string, savingsCat = 'Poupança'): number {
  let v = 0
  for (const t of txs) {
    if (t.date >= beforeDate) continue
    v += cashFlow(t, savingsCat)
  }
  return v
}

export interface MonthSummary {
  /** Rendimento real (exclui a categoria de poupança — é transferência). */
  income: number
  /** Gasto real: despesas normais + gastos pagos pela reserva (ambos são
   *  consumo). Exclui transferências (depósito/levantamento). */
  spending: number
  /** Variação líquida do "poupado" no mês: depósitos e aportes (reserva +
   *  investimentos) − levantamentos/resgates − gastos pagos pela reserva.
   *  Pode ficar negativa. */
  saved: number
  /** Balanço da conta corrente no mês (paga-te primeiro): Σ `cashFlow` —
   *  receitas − despesas − depósitos + levantamentos. O gasto da reserva não
   *  entra (já saiu da conta quando foi poupado). */
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
  let balance = 0
  const byCat: Record<string, number> = {}
  for (const t of txs) {
    if (t.date < start || t.date > end) continue
    balance += cashFlow(t, savingsCat)
    saved += savedFlow(t, savingsCat)
    const kind = txKind(t, savingsCat)
    if (kind === 'receita') income += t.amount
    else if (kind === 'despesa' || kind === 'gastoReserva') {
      spending += t.amount
      byCat[t.category] = (byCat[t.category] ?? 0) + t.amount
    }
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  return {
    income,
    spending,
    saved,
    balance,
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

export interface AnomalyTx {
  category: string
  amount: number
  type?: 'entrada' | 'saida'
  description?: string | null
}

export interface Anomaly {
  category: string
  amount: number
  description: string | null
  /** Média por-transação da categoria no histórico. */
  mean: number
  /** amount / mean (quantas vezes acima do normal). */
  ratio: number
}

/**
 * Cobranças incomuns: gastos do período cujo valor é muito acima do típico da
 * sua categoria (média por-transação no histórico). Só considera saídas (não
 * transferências: poupança e aportes são planeados), categorias com amostra
 * suficiente e valores acima de um piso absoluto, para não alarmar sobre
 * ruído. Ordena por rácio desc. Pura.
 */
export function detectAnomalies(
  monthTxs: AnomalyTx[],
  historyTxs: AnomalyTx[],
  opts: { savingsCat?: string; floor?: number; factor?: number; minSamples?: number } = {},
): Anomaly[] {
  const { savingsCat = 'Poupança', floor = 30, factor = 2.5, minSamples = 3 } = opts
  const transferCats = new Set([savingsCat, EMERGENCY_CAT, INVEST_CAT])
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const t of historyTxs) {
    if (t.type === 'entrada' || transferCats.has(t.category)) continue
    sums[t.category] = (sums[t.category] ?? 0) + t.amount
    counts[t.category] = (counts[t.category] ?? 0) + 1
  }
  const anomalies: Anomaly[] = []
  for (const t of monthTxs) {
    if (t.type === 'entrada' || transferCats.has(t.category)) continue
    const n = counts[t.category] ?? 0
    if (n < minSamples || t.amount < floor) continue
    const mean = sums[t.category] / n
    if (mean <= 0) continue
    const ratio = t.amount / mean
    if (ratio >= factor) {
      anomalies.push({ category: t.category, amount: t.amount, description: t.description ?? null, mean, ratio })
    }
  }
  return anomalies.sort((a, b) => b.ratio - a.ratio)
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
  spentByCat: Record<string, number>
  /** Média mensal de gasto por categoria nos últimos 3 meses completos. */
  catAvg3m: Record<string, number>
  budgets: Record<string, number>
  /** Categorias "conta fixa": não geram o aviso de "quase a ultrapassar". */
  fixedCats?: string[]
  /** Poupança líquida do mês anterior completo: depósitos − levantamentos na
   *  categoria de poupança (a mesma medida do cartão "Poupado"). */
  savingsPrevMonth: number
  /** Poupança líquida do mês corrente até agora (mesma medida). */
  savingsThisMonth: number
  /** Dias desde o último movimento registado (null = sem movimentos). */
  daysSinceLastTx: number | null
  /** Cobrança incomum a destacar (de detectAnomalies), se houver. */
  topAnomaly?: Anomaly | null
  /** Total mensal das assinaturas recorrentes ativas. */
  subscriptionsMonthly?: number
  /** Maior despesa fixa recorrente ativa. */
  topRecurring?: { cat: string; amount: number } | null
}

/**
 * Regras determinísticas que transformam os agregados do mês em orientações
 * curtas, ordenadas por relevância. Pura: recebe agregados e um formatador de
 * moeda, devolve texto pronto a mostrar.
 */
export function buildInsights(input: InsightInput, fmt: (v: number) => string): Insight[] {
  const out: Insight[] = []
  const {
    spentByCat, catAvg3m, budgets, fixedCats = [],
    savingsPrevMonth, savingsThisMonth, daysSinceLastTx,
    topAnomaly, subscriptionsMonthly = 0, topRecurring,
  } = input
  const fixed = new Set(fixedCats)

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
  // Contas fixas ficam de fora do aviso "quase" — atingir o orçamento é normal.
  const nearCat = budgeted
    .filter(([cat]) => !fixed.has(cat))
    .map(([cat, b]) => ({ cat, left: b - (spentByCat[cat] ?? 0), pct: (spentByCat[cat] ?? 0) / b }))
    .filter((c) => c.pct >= 0.85 && c.left > 0)
    .sort((a, b) => b.pct - a.pct)[0]
  if (nearCat) {
    out.push({
      id: `budget-near-${nearCat.cat}`, icon: '⏳', tone: 'warning', score: 80,
      text: `Estás a ${fmt(nearCat.left)} de ultrapassar o orçamento de ${nearCat.cat}.`,
    })
  }

  // Cobrança incomum (anomalia): entre "ultrapassou" e "quase" em relevância.
  if (topAnomaly) {
    const veryHigh = topAnomaly.ratio >= 4
    const desc = topAnomaly.description ? ` (${topAnomaly.description})` : ''
    out.push({
      id: `anomaly-${topAnomaly.category}-${Math.round(topAnomaly.amount)}`,
      icon: '🔎', tone: veryHigh ? 'danger' : 'warning', score: 85,
      text: `Cobrança incomum: ${fmt(topAnomaly.amount)} em ${topAnomaly.category}${desc} — ${topAnomaly.ratio.toFixed(1)}× o teu gasto habitual (${fmt(topAnomaly.mean)}).`,
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

  // Assinaturas recorrentes: custo mensal e anualizado (perceção de valor alta).
  if (subscriptionsMonthly > 0) {
    out.push({
      id: 'subscriptions', icon: '📺', tone: 'info', score: 32,
      text: `As tuas assinaturas somam ${fmt(subscriptionsMonthly)}/mês — ${fmt(subscriptionsMonthly * 12)}/ano.`,
    })
  }

  // Maior despesa fixa recorrente.
  if (topRecurring && topRecurring.amount > 0) {
    out.push({
      id: `top-recurring-${topRecurring.cat}`, icon: '📌', tone: 'info', score: 24,
      text: `A tua maior despesa fixa é ${topRecurring.cat}: ${fmt(topRecurring.amount)}/mês.`,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}
