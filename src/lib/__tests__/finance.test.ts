import { describe, it, expect } from 'vitest'
import {
  sumInRange,
  monthlySavings,
  monthlySavedChange,
  categoryTotals,
  buildBudgetSummary,
  unbudgetedSpend,
  buildInsights,
  pendingRecurrences,
  recurringMonthlyTotal,
  buildMonthSummary,
  monthCloseHeadline,
  loggingStreak,
  carryIn,
  cashFlow,
  reserveFlow,
  savedFlow,
  txKind,
  detectAnomalies,
  type AnomalyTx,
  type FinTx,
  type InsightInput,
  type RecurringLike,
  type MonthSummary,
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
  it('inclui/exclui os gastos pagos pela reserva conforme includeReserve', () => {
    const withReserve: FinTx[] = [
      { date: '2026-01-10', type: 'saida', amount: 200, category: 'Alimentação' },
      { date: '2026-01-15', type: 'saida', amount: 400, category: 'Saúde', from_reserve: true },
    ]
    // default (true): o gasto da reserva conta como consumo
    expect(categoryTotals(withReserve, '2026-01-01', '2026-01-31')).toEqual({ Alimentação: 200, Saúde: 400 })
    // gauge de orçamento (false): fica de fora
    expect(categoryTotals(withReserve, '2026-01-01', '2026-01-31', { includeReserve: false })).toEqual({ Alimentação: 200 })
  })
  it('conta aportes na sua categoria só com includeContributions', () => {
    const withContribs: FinTx[] = [
      { date: '2026-01-10', type: 'saida', amount: 200, category: 'Alimentação' },
      { date: '2026-01-15', type: 'saida', amount: 140, category: 'Emergências' },
      { date: '2026-01-15', type: 'saida', amount: 210, category: 'Investimentos' },
      { date: '2026-01-20', type: 'entrada', amount: 50, category: 'Investimentos' }, // resgate: nunca conta
    ]
    // consumo (default): aportes ficam de fora — não são gasto
    expect(categoryTotals(withContribs, '2026-01-01', '2026-01-31')).toEqual({ Alimentação: 200 })
    // envelopes do orçamento: aportes enchem a sua categoria
    expect(categoryTotals(withContribs, '2026-01-01', '2026-01-31', { includeContributions: true }))
      .toEqual({ Alimentação: 200, Emergências: 140, Investimentos: 210 })
  })
})

describe('txKind / cashFlow / reserveFlow / savedFlow', () => {
  const cases: { t: FinTx; kind: string; cash: number; reserve: number; saved: number }[] = [
    { t: { date: 'd', type: 'entrada', amount: 100, category: 'Salário' },  kind: 'receita',      cash: 100,  reserve: 0, saved: 0 },
    { t: { date: 'd', type: 'saida',   amount: 100, category: 'Alimentação' }, kind: 'despesa',    cash: -100, reserve: 0, saved: 0 },
    { t: { date: 'd', type: 'entrada', amount: 100, category: 'Poupança' },  kind: 'deposito',     cash: -100, reserve: 100, saved: 100 },
    { t: { date: 'd', type: 'saida',   amount: 100, category: 'Poupança' },  kind: 'levantamento', cash: 100,  reserve: -100, saved: -100 },
    { t: { date: 'd', type: 'saida',   amount: 100, category: 'Saúde', from_reserve: true }, kind: 'gastoReserva', cash: 0, reserve: -100, saved: -100 },
    // Aportes (convenção da conta): saída = guardar/investir, entrada = resgatar.
    { t: { date: 'd', type: 'saida',   amount: 100, category: 'Emergências' }, kind: 'aporteReserva',  cash: -100, reserve: 100,  saved: 100 },
    { t: { date: 'd', type: 'entrada', amount: 100, category: 'Emergências' }, kind: 'resgateReserva', cash: 100,  reserve: -100, saved: -100 },
    { t: { date: 'd', type: 'saida',   amount: 100, category: 'Investimentos' }, kind: 'aporteInvest',  cash: -100, reserve: 0, saved: 100 },
    { t: { date: 'd', type: 'entrada', amount: 100, category: 'Investimentos' }, kind: 'resgateInvest', cash: 100,  reserve: 0, saved: -100 },
  ]
  it('classifica e dá os sinais certos sobre conta, reserva e poupado', () => {
    for (const c of cases) {
      expect(txKind(c.t)).toBe(c.kind)
      expect(cashFlow(c.t)).toBe(c.cash)
      expect(reserveFlow(c.t)).toBe(c.reserve)
      expect(savedFlow(c.t)).toBe(c.saved)
    }
  })
})

describe('monthlySavedChange', () => {
  it('soma o fluxo-poupado por intervalo (depósito/aporte +, levantamento/gasto −)', () => {
    const m: FinTx[] = [
      { date: '2026-01-05', type: 'entrada', amount: 300, category: 'Poupança' },
      { date: '2026-01-20', type: 'saida',   amount: 100, category: 'Poupança' },
      { date: '2026-01-25', type: 'saida',   amount: 150, category: 'Investimentos' },
      { date: '2026-02-10', type: 'saida',   amount: 400, category: 'Saúde', from_reserve: true },
      { date: '2026-02-15', type: 'saida',   amount: 140, category: 'Emergências' },
    ]
    expect(monthlySavedChange(m, [
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-02-01', end: '2026-02-28' },
    ])).toEqual([350, -260])
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

  it('marca as linhas de contas fixas com fixed:true', () => {
    const s = buildBudgetSummary(budgets, spent, outCats, ['Transporte'])
    expect(s.rows.find((r) => r.cat === 'Transporte')!.fixed).toBe(true)
    expect(s.rows.find((r) => r.cat === 'Alimentação')!.fixed).toBe(false)
  })
})

describe('unbudgetedSpend', () => {
  const spent = { Alimentação: 250, Lazer: 80, Poupança: 200 }
  it('soma só o gasto de categorias sem orçamento', () => {
    expect(unbudgetedSpend(spent, { Alimentação: 300 })).toBe(280)
  })
  it('respeita a lista de exclusão', () => {
    expect(unbudgetedSpend(spent, { Alimentação: 300 }, ['Poupança'])).toBe(80)
  })
  it('devolve 0 quando tudo está orçamentado', () => {
    expect(unbudgetedSpend({ Lazer: 80 }, { Lazer: 100 })).toBe(0)
  })
})

describe('buildInsights', () => {
  const eur = (v: number) => `€${v}`
  const base: InsightInput = {
    spentByCat: {},
    catAvg3m: {},
    budgets: {},
    savingsPrevMonth: 0,
    savingsThisMonth: 0,
    daysSinceLastTx: 0,
  }

  it('deteta orçamento ultrapassado e quase ultrapassado', () => {
    const out = buildInsights({
      ...base,
      budgets: { Lazer: 100, Alimentação: 400 },
      spentByCat: { Lazer: 130, Alimentação: 350 },
    }, eur)
    const ids = out.map((i) => i.id)
    expect(ids).toContain('budget-over-Lazer')
    expect(ids).toContain('budget-near-Alimentação')
    expect(ids.indexOf('budget-over-Lazer')).toBeLessThan(ids.indexOf('budget-near-Alimentação'))
  })

  it('não avisa "quase" para contas fixas (mas mantém "ultrapassou")', () => {
    const out = buildInsights({
      ...base,
      budgets: { Renda: 500, Alimentação: 400 },
      spentByCat: { Renda: 500, Alimentação: 350 },
      fixedCats: ['Renda'],
    }, eur)
    const ids = out.map((i) => i.id)
    // Renda a 100% é fixa → sem aviso "quase"; Alimentação a 87% mantém
    expect(ids).not.toContain('budget-near-Renda')
    expect(ids).toContain('budget-near-Alimentação')
    // ultrapassar uma conta fixa continua a avisar
    const over = buildInsights({
      ...base, budgets: { Renda: 500 }, spentByCat: { Renda: 560 }, fixedCats: ['Renda'],
    }, eur)
    expect(over.map((i) => i.id)).toContain('budget-over-Renda')
  })

  it('deteta desvio ≥15% face à média 3m, ignorando médias pequenas', () => {
    const out = buildInsights({
      ...base,
      spentByCat: { Alimentação: 240, Roupa: 15 },
      catAvg3m: { Alimentação: 200, Roupa: 5 },
    }, eur)
    expect(out.map((i) => i.id)).toContain('spike-Alimentação')
    expect(out.map((i) => i.id)).not.toContain('spike-Roupa')
    expect(out.find((i) => i.id === 'spike-Alimentação')!.text).toContain('+20%')
  })

  it('avisa quando há 5+ dias sem registos', () => {
    expect(buildInsights({ ...base, daysSinceLastTx: 6 }, eur).map((i) => i.id)).toContain('stale-log')
    expect(buildInsights({ ...base, daysSinceLastTx: 2 }, eur)).toHaveLength(0)
  })

  it('celebra poupança só quando o mês parcial já bate o mês anterior completo', () => {
    const beat = buildInsights({ ...base, savingsThisMonth: 300, savingsPrevMonth: 250 }, eur)
    expect(beat.map((i) => i.id)).toContain('savings-beat')
    const notYet = buildInsights({ ...base, savingsThisMonth: 200, savingsPrevMonth: 250 }, eur)
    expect(notYet.map((i) => i.id)).not.toContain('savings-beat')
  })

  it('poupança batida fica no topo dos insights positivos', () => {
    const out = buildInsights({ ...base, savingsThisMonth: 300, savingsPrevMonth: 100 }, eur)
    expect(out[0].id).toBe('savings-beat')
  })
})

describe('pendingRecurrences', () => {
  const rules: RecurringLike[] = [
    { id: 'r1', type: 'saida',   category: 'Habitação',   description: 'Renda',   amount: 650, day_of_month: 1,  active: true },
    { id: 'r2', type: 'entrada', category: 'Salário',     description: null,      amount: 1200, day_of_month: 25, active: true },
    { id: 'r3', type: 'saida',   category: 'Assinaturas', description: 'Netflix', amount: 15,  day_of_month: 5,  active: false },
  ]

  it('mostra só regras ativas cujo dia já chegou e ainda não foram lançadas', () => {
    const out = pendingRecurrences(rules, [], 10, '2026-07')
    expect(out.map((r) => r.id)).toEqual(['r1']) // r2 ainda não (dia 25), r3 inativa
  })

  it('exclui regras já lançadas neste mês (por recurring_id)', () => {
    const out = pendingRecurrences(rules, ['r1'], 26, '2026-07')
    expect(out.map((r) => r.id)).toEqual(['r2'])
  })

  it('exclui regras saltadas manualmente no mês', () => {
    const out = pendingRecurrences(rules, [], 26, '2026-07', ['r1:2026-07'])
    expect(out.map((r) => r.id)).toEqual(['r2'])
    // o skip é específico do mês
    expect(pendingRecurrences(rules, [], 26, '2026-08', ['r1:2026-07']).map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('ordena por dia do mês', () => {
    const out = pendingRecurrences(rules, [], 31, '2026-07')
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})

describe('recurringMonthlyTotal', () => {
  const rules: RecurringLike[] = [
    { id: 'r1', type: 'saida',   category: 'Habitação', description: null, amount: 650, day_of_month: 1,  active: true },
    { id: 'r2', type: 'saida',   category: 'Assinaturas', description: null, amount: 15, day_of_month: 5, active: false },
    { id: 'r3', type: 'entrada', category: 'Salário', description: null, amount: 1200, day_of_month: 25, active: true },
  ]
  it('soma só as ativas do tipo pedido', () => {
    expect(recurringMonthlyTotal(rules, 'saida')).toBe(650)
    expect(recurringMonthlyTotal(rules, 'entrada')).toBe(1200)
  })
})

describe('buildMonthSummary', () => {
  const m: FinTx[] = [
    { date: '2026-06-02', type: 'entrada', amount: 1200, category: 'Salário' },
    { date: '2026-06-05', type: 'saida',   amount: 400,  category: 'Alimentação' },
    { date: '2026-06-08', type: 'saida',   amount: 150,  category: 'Transporte' },
    { date: '2026-06-10', type: 'entrada', amount: 200,  category: 'Poupança' },   // depósito na reserva
    { date: '2026-07-01', type: 'saida',   amount: 999,  category: 'Alimentação' }, // fora do intervalo
  ]
  it('depositar reduz o balanço (paga-te primeiro); separa gasto e maior categoria', () => {
    const s = buildMonthSummary(m, '2026-06-01', '2026-06-30')
    expect(s.income).toBe(1200)           // o depósito na poupança não é rendimento
    expect(s.spending).toBe(550)          // 400 + 150
    expect(s.saved).toBe(200)
    expect(s.balance).toBe(450)           // 1200 − 550 − 200 (depósito subtrai)
    expect(s.topCat).toEqual({ cat: 'Alimentação', amount: 400 })
  })
  it('topCat é null sem gastos', () => {
    expect(buildMonthSummary([{ date: '2026-06-01', type: 'entrada', amount: 10, category: 'x' }], '2026-06-01', '2026-06-30').topCat).toBeNull()
  })
  it('levantamento da poupança (saída Poupança) devolve ao balanço e subtrai ao poupado', () => {
    const withWithdrawal: FinTx[] = [
      ...m,
      { date: '2026-06-15', type: 'saida', amount: 80, category: 'Poupança' },
    ]
    const s = buildMonthSummary(withWithdrawal, '2026-06-01', '2026-06-30')
    expect(s.spending).toBe(550)                // o levantamento não é gasto
    expect(s.saved).toBe(120)                   // 200 depositados − 80 levantados
    expect(s.balance).toBe(530)                 // 450 + 80 devolvidos à conta
  })
  it('gasto pago pela reserva: conta como gasto, reduz o poupado, não mexe no balanço', () => {
    const withReserveSpend: FinTx[] = [
      ...m,
      { date: '2026-06-18', type: 'saida', amount: 500, category: 'Saúde', from_reserve: true },
    ]
    const s = buildMonthSummary(withReserveSpend, '2026-06-01', '2026-06-30')
    expect(s.spending).toBe(1050)               // 550 + 500 (é consumo real)
    expect(s.saved).toBe(-300)                  // 200 depositados − 500 gastos da reserva
    expect(s.balance).toBe(450)                 // inalterado: já saiu da conta ao poupar
    expect(s.topCat).toEqual({ cat: 'Saúde', amount: 500 })
  })
  it('poupar 300 e depois gastar 300 da reserva não descontam o balanço duas vezes', () => {
    const s = buildMonthSummary([
      { date: '2026-06-05', type: 'entrada', amount: 1000, category: 'Salário' },
      { date: '2026-06-10', type: 'entrada', amount: 300,  category: 'Poupança' },
      { date: '2026-06-20', type: 'saida',   amount: 300,  category: 'Saúde', from_reserve: true },
    ], '2026-06-01', '2026-06-30')
    expect(s.balance).toBe(700)                 // 1000 − 300 (só o depósito toca no balanço)
    expect(s.saved).toBe(0)                     // 300 depositados − 300 gastos da reserva
  })
  it('poupança do mês fica negativa quando levanta mais do que deposita', () => {
    const s = buildMonthSummary([
      { date: '2026-06-10', type: 'entrada', amount: 50,  category: 'Poupança' },
      { date: '2026-06-20', type: 'saida',   amount: 200, category: 'Poupança' },
    ], '2026-06-01', '2026-06-30')
    expect(s.saved).toBe(-150)
    expect(s.income).toBe(0)
    expect(s.spending).toBe(0)
  })
  it('aportes a Emergências/Investimentos: não são gasto, contam no poupado e saem do balanço', () => {
    const s = buildMonthSummary([
      { date: '2026-06-02', type: 'entrada', amount: 1000, category: 'Salário' },
      { date: '2026-06-05', type: 'saida',   amount: 300,  category: 'Alimentação' },
      { date: '2026-06-10', type: 'saida',   amount: 140,  category: 'Emergências' },
      { date: '2026-06-10', type: 'saida',   amount: 210,  category: 'Investimentos' },
    ], '2026-06-01', '2026-06-30')
    expect(s.income).toBe(1000)
    expect(s.spending).toBe(300)          // aportes não são consumo
    expect(s.saved).toBe(350)             // 140 reserva + 210 investimentos
    expect(s.balance).toBe(350)           // 1000 − 300 − 140 − 210
    expect(s.topCat).toEqual({ cat: 'Alimentação', amount: 300 })
  })
})

describe('monthCloseHeadline', () => {
  const eur = (v: number) => `€${v}`
  const base: MonthSummary = { income: 1000, spending: 500, saved: 0, balance: 500, topCat: null }
  it('destaca poupança quando poupou e ≥ mês anterior', () => {
    const h = monthCloseHeadline({ ...base, saved: 150 }, { ...base, saved: 100 }, eur)
    expect(h.tone).toBe('positive')
    expect(h.text).toContain('Poupaste €150')
  })
  it('destaca sobra maior que o mês anterior', () => {
    const h = monthCloseHeadline({ ...base, balance: 600 }, { ...base, balance: 400 }, eur)
    expect(h.text).toContain('€200 a mais')
  })
  it('destaca ter gasto menos', () => {
    const h = monthCloseHeadline({ ...base, spending: 400, balance: 600 }, { ...base, spending: 700, balance: 300 }, eur)
    // balance 600 > 300 → entra na regra da sobra; garante que é sempre positivo
    expect(h.tone).toBe('positive')
  })
  it('cai numa mensagem neutra mas encorajadora no negativo', () => {
    const h = monthCloseHeadline({ ...base, balance: -100 }, { ...base, balance: -50 }, eur)
    expect(h.tone).toBe('info')
    expect(h.text).toContain('nova página')
  })
})

describe('loggingStreak', () => {
  it('conta dias consecutivos terminando hoje', () => {
    const s = loggingStreak(['2026-07-15','2026-07-14','2026-07-13','2026-07-11'], '2026-07-15')
    expect(s).toEqual({ current: 3, loggedToday: true }) // 15,14,13 (11 quebra)
  })
  it('mantém a sequência viva se registou ontem mas ainda não hoje', () => {
    const s = loggingStreak(['2026-07-14','2026-07-13'], '2026-07-15')
    expect(s).toEqual({ current: 2, loggedToday: false })
  })
  it('sequência 0 se não registou hoje nem ontem', () => {
    expect(loggingStreak(['2026-07-12'], '2026-07-15')).toEqual({ current: 0, loggedToday: false })
  })
  it('tolera datas repetidas e desordenadas', () => {
    const s = loggingStreak(['2026-07-15','2026-07-15','2026-07-14'], '2026-07-15')
    expect(s.current).toBe(2)
  })
})

describe('detectAnomalies', () => {
  const history: AnomalyTx[] = [
    { category: 'Contas', amount: 30, type: 'saida' },
    { category: 'Contas', amount: 28, type: 'saida' },
    { category: 'Contas', amount: 32, type: 'saida' },   // média ≈ 30
    { category: 'Alimentação', amount: 40, type: 'saida' },
    { category: 'Alimentação', amount: 50, type: 'saida' },
    { category: 'Alimentação', amount: 45, type: 'saida' },
  ]
  it('assinala uma cobrança muito acima do normal da categoria', () => {
    const a = detectAnomalies([{ category: 'Contas', amount: 90, type: 'saida', description: 'EDP' }], history)
    expect(a).toHaveLength(1)
    expect(a[0].category).toBe('Contas')
    expect(a[0].ratio).toBeCloseTo(3, 1) // 90 / 30
    expect(a[0].description).toBe('EDP')
  })
  it('ignora valores dentro do normal e abaixo do piso', () => {
    expect(detectAnomalies([{ category: 'Alimentação', amount: 55, type: 'saida' }], history)).toHaveLength(0)
    expect(detectAnomalies([{ category: 'Contas', amount: 20, type: 'saida' }], history)).toHaveLength(0) // < floor 30
  })
  it('ignora categorias sem amostra suficiente, entradas e transferências', () => {
    expect(detectAnomalies([{ category: 'Roupa', amount: 500, type: 'saida' }], history)).toHaveLength(0)
    expect(detectAnomalies([{ category: 'Contas', amount: 300, type: 'entrada' }], history)).toHaveLength(0)
    expect(detectAnomalies([{ category: 'Poupança', amount: 300, type: 'saida' }], history)).toHaveLength(0)
    expect(detectAnomalies([{ category: 'Emergências', amount: 300, type: 'saida' }], history)).toHaveLength(0)
    expect(detectAnomalies([{ category: 'Investimentos', amount: 300, type: 'saida' }], history)).toHaveLength(0)
  })
  it('ordena por rácio desc', () => {
    const a = detectAnomalies([
      { category: 'Contas', amount: 90, type: 'saida' },        // 3×
      { category: 'Alimentação', amount: 225, type: 'saida' },  // 5×
    ], history)
    expect(a.map(x => x.category)).toEqual(['Alimentação', 'Contas'])
  })
})

describe('buildInsights — motor completo', () => {
  const eur = (v: number) => `€${v}`
  const base = {
    spentByCat: {}, catAvg3m: {}, budgets: {},
    savingsPrevMonth: 0, savingsThisMonth: 0, daysSinceLastTx: 0,
  }
  it('emite cobrança incomum com relevância alta', () => {
    const out = buildInsights({ ...base, topAnomaly: { category: 'Contas', amount: 90, description: 'EDP', mean: 30, ratio: 3 } }, eur)
    const a = out.find(i => i.id.startsWith('anomaly-'))!
    expect(a).toBeDefined()
    expect(a.text).toContain('Cobrança incomum')
    expect(a.text).toContain('3.0×')
    expect(a.score).toBe(85)
  })
  it('anomalia muito alta (≥4×) fica em tom danger', () => {
    const out = buildInsights({ ...base, topAnomaly: { category: 'X', amount: 200, description: null, mean: 40, ratio: 5 } }, eur)
    expect(out.find(i => i.id.startsWith('anomaly-'))!.tone).toBe('danger')
  })
  it('emite insight de assinaturas e de maior despesa fixa', () => {
    const out = buildInsights({ ...base, subscriptionsMonthly: 47, topRecurring: { cat: 'Habitação', amount: 650 } }, eur)
    const subs = out.find(i => i.id === 'subscriptions')!
    expect(subs.text).toContain('€47/mês')
    expect(subs.text).toContain('€564/ano') // 47 × 12
    expect(out.find(i => i.id.startsWith('top-recurring-'))!.text).toContain('Habitação')
  })
})

describe('carryIn', () => {
  const txs: FinTx[] = [
    { date: '2026-06-02', type: 'entrada', amount: 1200, category: 'Salário' },
    { date: '2026-06-05', type: 'saida',   amount: 550,  category: 'Alimentação' },
    { date: '2026-06-10', type: 'entrada', amount: 200,  category: 'Poupança' },   // depósito: sai da conta corrente
    { date: '2026-07-03', type: 'saida',   amount: 999,  category: 'Alimentação' }, // mês corrente: não conta
  ]
  it('soma o líquido dos meses anteriores (depositar na poupança tira da conta)', () => {
    // 1200 − 550 − 200 = 450
    expect(carryIn(txs, '2026-07-01')).toBe(450)
  })
  it('exclui o mês corrente (>= beforeDate)', () => {
    expect(carryIn(txs, '2026-06-01')).toBe(0) // nada antes de junho
  })
  it('pode ser negativo se gastou mais do que entrou', () => {
    expect(carryIn([{ date: '2026-05-01', type: 'saida', amount: 80, category: 'x' }], '2026-06-01')).toBe(-80)
  })
  it('levantar da poupança devolve o dinheiro à conta corrente', () => {
    const withWithdrawal: FinTx[] = [
      ...txs,
      { date: '2026-06-15', type: 'saida', amount: 100, category: 'Poupança' },
    ]
    // 1200 − 550 − 200 + 100 = 550
    expect(carryIn(withWithdrawal, '2026-07-01')).toBe(550)
  })
})
