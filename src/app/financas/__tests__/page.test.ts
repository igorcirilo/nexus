// Teste de renderização da página /financas com dados simulados: cobre o
// hero (balanço + projeção + comparação), o insight do dia, o aviso de gasto
// fora do orçamento, a secção Visão geral, a exportação e a sugestão de
// categoria no formulário — a cablagem que os testes puros de finance.ts
// não veem.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import FinancasPage from '@/app/financas/page'

// O jsdom não tem ResizeObserver e o ResponsiveContainer do recharts exige-o.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

const profile = {
  id: 'u1',
  fin_budgets: { Lazer: 100 },
  fin_monthly_save: null,
  fin_reserve_goal: null,
  fin_current_savings: null,
}

// "Hoje" fixo a 15-07-2026 (só o Date é falsificado; timers/promises reais).
const TODAY = new Date('2026-07-15T10:00:00')

const txsRecentes = [
  { id: 't1', user_id: 'u1', date: '2026-07-12', type: 'saida',   category: 'Lazer',       description: null, amount: 90,   created_at: '' },
  { id: 't2', user_id: 'u1', date: '2026-07-10', type: 'saida',   category: 'Alimentação', description: null, amount: 300,  created_at: '' },
  { id: 't3', user_id: 'u1', date: '2026-07-01', type: 'entrada', category: 'Salário',     description: null, amount: 1000, created_at: '' },
  { id: 't4', user_id: 'u1', date: '2026-06-10', type: 'saida',   category: 'Alimentação', description: null, amount: 200,  created_at: '' },
]

const history = [
  { date: '2026-04-05', type: 'saida',   amount: 200,  category: 'Alimentação' },
  { date: '2026-05-05', type: 'saida',   amount: 200,  category: 'Alimentação' },
  { date: '2026-06-10', type: 'saida',   amount: 200,  category: 'Alimentação' },
  { date: '2026-06-01', type: 'entrada', amount: 1000, category: 'Salário' },
  { date: '2026-07-01', type: 'entrada', amount: 1000, category: 'Salário' },
  { date: '2026-07-10', type: 'saida',   amount: 300,  category: 'Alimentação' },
  { date: '2026-07-12', type: 'saida',   amount: 90,   category: 'Lazer' },
]

// r1 (Renda, dia 1) já venceu a 15/07 e não tem transação com recurring_id →
// fica pendente; r2 (Salário, dia 25) ainda não venceu.
const RULES = [
  { id: 'r1', user_id: 'u1', type: 'saida',   category: 'Habitação', description: 'Renda', amount: 650,  day_of_month: 1,  active: true, created_at: '' },
  { id: 'r2', user_id: 'u1', type: 'entrada', category: 'Salário',   description: null,    amount: 1200, day_of_month: 25, active: true, created_at: '' },
]

// Junho (mês anterior) — devolvido por getTransactionsForMonth ao navegar ‹.
const JUNE_TXS = [
  { id: 'j1', user_id: 'u1', date: '2026-06-20', type: 'saida',   category: 'Roupa',   description: 'Casaco', amount: 120, created_at: '' },
  { id: 'j2', user_id: 'u1', date: '2026-06-05', type: 'entrada', category: 'Salário', description: null,     amount: 1000, created_at: '' },
]
// Resultado da pesquisa global (qualquer mês).
const SEARCH_TXS = [
  { id: 's1', user_id: 'u1', date: '2026-03-14', type: 'saida', category: 'Alimentação', description: 'Continente Braga', amount: 42, created_at: '' },
]

vi.mock('@/lib/supabase', () => ({
  requireUser: vi.fn(async () => ({ id: 'u1' })),
  getProfile: vi.fn(async () => profile),
  getTransactions: vi.fn(async () => txsRecentes),
  getTransactionsByMonth: vi.fn(async () => history),
  getAllTransactions: vi.fn(async () => txsRecentes),
  saveTransaction: vi.fn(async () => ({ data: null, error: null })),
  saveTransactionsBulk: vi.fn(async () => ({ data: [], error: null })),
  updateTransaction: vi.fn(async () => ({ data: null, error: null })),
  deleteTransaction: vi.fn(async () => ({ error: null })),
  updateFinancialGoals: vi.fn(async () => ({})),
  updateBudgets: vi.fn(async () => ({})),
  getRecurringRules: vi.fn(async () => RULES),
  saveRecurringRule: vi.fn(async () => ({ data: null, error: null })),
  updateRecurringRule: vi.fn(async () => ({ data: null, error: null })),
  deleteRecurringRule: vi.fn(async () => ({ error: null })),
  getTransactionsForMonth: vi.fn(async () => JUNE_TXS),
  searchTransactions: vi.fn(async () => SEARCH_TXS),
}))

vi.mock('@/components/Nav', () => ({ default: () => null }))
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

async function renderPage() {
  // createElement em vez de JSX: o vitest deste projeto segue o tsconfig do
  // Next (jsx: preserve) e não transforma JSX em ficheiros de teste.
  render(createElement(FinancasPage))
  await waitFor(() => expect(screen.getByText(/Balanço do mês/)).toBeDefined())
}

describe('FinancasPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY })
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra o balanço com legenda, projeção de fim de mês e comparação com o mês anterior', async () => {
    await renderPage()
    // entradas 1000 − saídas 390 (julho)
    expect(screen.queryByText(/Saldo do mês/)).toBeNull()
    expect(screen.getByText(/entradas − saídas de julho/)).toBeDefined()
    // dia 15 de 31: 390/15×31 ≈ 806 de saídas projetadas → ≈ +194
    expect(screen.getByText(/Ao ritmo atual: ≈ 194/)).toBeDefined()
    // saídas até dia 15: julho 390 vs. junho 200 → ▲ 95%
    expect(screen.getByText(/▲ 95% vs\./)).toBeDefined()
  })

  it('destaca o insight mais relevante (orçamento de Lazer a 90%)', async () => {
    await renderPage()
    expect(screen.getByText('Insight')).toBeDefined()
    expect(screen.getByText(/de ultrapassar o orçamento de Lazer/)).toBeDefined()
  })

  it('mostra o gasto em categorias sem orçamento ao lado do gauge', async () => {
    await renderPage()
    expect(screen.getByText(/gastos em categorias sem orçamento/)).toBeDefined()
  })

  it('mostra a visão geral: top categorias e 6 meses', async () => {
    await renderPage()
    expect(screen.getByText(/Para onde foi o dinheiro/)).toBeDefined()
    expect(screen.getByText('Entradas vs. saídas · 6 meses')).toBeDefined()
  })

  it('tem exportação CSV no menu de mais opções', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Mais opções'))
    expect(screen.getByText(/Exportar CSV/)).toBeDefined()
  })

  it('sugere categoria a partir da descrição no formulário', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Registar movimento'))
    fireEvent.change(screen.getByPlaceholderText('Opcional'), { target: { value: 'compras continente' } })
    expect(screen.getByText(/Sugestão: 🍔 Alimentação/)).toBeDefined()
  })

  it('mostra recorrências por pagar (regra vencida e não lançada)', async () => {
    await renderPage()
    expect(screen.getByText('A pagar este mês')).toBeDefined()
    expect(screen.getByLabelText('Registar Habitação')).toBeDefined()
    // Salário só vence a dia 25 → não aparece como pendente a 15/07
    expect(screen.queryByLabelText('Registar Salário')).toBeNull()
  })

  it('lança uma recorrência ao confirmar', async () => {
    const { saveTransaction } = await import('@/lib/supabase')
    await renderPage()
    fireEvent.click(screen.getByLabelText('Registar Habitação'))
    await waitFor(() => expect(saveTransaction).toHaveBeenCalled())
    const call = (saveTransaction as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0]
    expect(call.recurring_id).toBe('r1')
    expect(call.category).toBe('Habitação')
    expect(call.amount).toBe(650)
  })

  it('tem o toggle de repetição no formulário', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Registar movimento'))
    expect(screen.getByText('Repetir todos os meses')).toBeDefined()
  })

  it('navega para o mês anterior e carrega os seus movimentos sob demanda', async () => {
    const { getTransactionsForMonth } = await import('@/lib/supabase')
    await renderPage()
    // abre o sheet de movimentos pelo hero
    fireEvent.click(screen.getByLabelText('Ver movimentos'))
    expect(await screen.findByText(/Julho 2026/)).toBeDefined()
    fireEvent.click(screen.getByLabelText('Mês anterior'))
    expect(await screen.findByText(/Junho 2026/)).toBeDefined()
    await waitFor(() => expect(getTransactionsForMonth).toHaveBeenCalled())
    // movimento de junho aparece
    expect(await screen.findByText('Roupa')).toBeDefined()
  })

  it('não deixa avançar para além do mês corrente', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Ver movimentos'))
    const next = await screen.findByLabelText('Mês seguinte') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('pesquisa em todo o histórico com ≥2 caracteres', async () => {
    const { searchTransactions } = await import('@/lib/supabase')
    await renderPage()
    fireEvent.click(screen.getByLabelText('Ver movimentos'))
    fireEvent.change(await screen.findByPlaceholderText('Pesquisar movimentos…'), { target: { value: 'continente' } })
    await waitFor(() => expect(searchTransactions).toHaveBeenCalledWith('u1', 'continente'))
    expect(await screen.findByText(/em todo o histórico/)).toBeDefined()
    expect(await screen.findByText('Continente Braga')).toBeDefined()
  })
})
