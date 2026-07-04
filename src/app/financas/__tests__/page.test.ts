// Teste de renderização da página /financas com dados simulados: cobre o
// hero (balanço + projeção + comparação), o insight do dia, o aviso de gasto
// fora do orçamento, a secção Visão geral, a exportação e a sugestão de
// categoria no formulário — a cablagem que os testes puros de finance.ts
// não veem.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
  { id: 't5', user_id: 'u1', date: '2026-07-08', type: 'entrada', category: 'Poupança',    description: null, amount: 150,  created_at: '' },
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
  getReminders: vi.fn(async () => []),
  saveReminder: vi.fn(async () => ({ data: null, error: null })),
  deleteReminder: vi.fn(async () => ({ data: null, error: null })),
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
    // Marca o fecho de junho como já visto, para não abrir sozinho nos testes
    // que não são sobre ele (a data fixa é 15/07 → mês anterior = 2026-06).
    localStorage.setItem('nexus_monthclose_seen_u1', '2026-06')
  })
  afterEach(() => {
    cleanup() // desmonta o render anterior (evita DOM acumulado entre testes)
    vi.useRealTimers()
  })

  it('mostra o balanço com legenda e comparação com o mês anterior (sem projeção/ritmo no hero)', async () => {
    await renderPage()
    // entradas 1000 − saídas 390 (julho)
    expect(screen.queryByText(/Saldo do mês/)).toBeNull()
    expect(screen.getByText(/entradas − gastos de julho/)).toBeDefined()
    // a projeção "ao ritmo atual" foi removida do hero
    expect(screen.queryByText(/Ao ritmo atual/)).toBeNull()
    // gastos até dia 15: julho 390 vs. junho 200 → ▲ 95%
    expect(screen.getByText(/▲ 95% vs\./)).toBeDefined()
  })

  it('arrasta o saldo do mês anterior: começaste com X, disponível Y', async () => {
    await renderPage()
    // carryIn = 1000(jun) − 200(abr) − 200(mai) − 200(jun) = 400
    // disponível = 400 + balance(610) − poupado(150) = 860
    expect(screen.getByText(/Começaste julho com/)).toBeDefined()
    expect(screen.getByText('400,00 €')).toBeDefined()
    expect(screen.getByText('860,00 €')).toBeDefined()
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

  it('trata Poupança como transferência: fora das entradas/gastos, mostrada à parte', async () => {
    await renderPage()
    // Depósito de 150 (entrada Poupança) fica fora das entradas (1000) e é
    // mostrado à parte como poupado
    expect(screen.getByText(/🏦 Poupado/)).toBeDefined()
    expect(screen.getByText('150,00 €')).toBeDefined()
    // se contasse o depósito como entrada seriam 1150 — não deve aparecer
    expect(screen.queryByText(/1\s?150,00/)).toBeNull()
  })

  it('registar depósito (entrada Poupança) soma à reserva (fin_current_savings)', async () => {
    const { updateFinancialGoals } = await import('@/lib/supabase')
    await renderPage()
    fireEvent.click(screen.getByLabelText('Registar movimento'))
    fireEvent.click(screen.getByText('↓ Entrada'))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: '🏦 Poupança' }))
    fireEvent.click(screen.getByText('Guardar movimento'))
    // reserva base 0 (profile.fin_current_savings null) + 200 = 200
    await waitFor(() => expect(updateFinancialGoals).toHaveBeenCalledWith('u1', { fin_current_savings: 200 }))
  })

  it('registar levantamento (saída Poupança) subtrai à reserva', async () => {
    const { getProfile, updateFinancialGoals } = await import('@/lib/supabase')
    ;(getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ ...profile, fin_current_savings: 500 })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Registar movimento'))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: '🏦 Poupança' }))
    fireEvent.click(screen.getByText('Guardar movimento'))
    // reserva 500 − 200 = 300 (tipo por omissão do formulário é saída)
    await waitFor(() => expect(updateFinancialGoals).toHaveBeenCalledWith('u1', { fin_current_savings: 300 }))
    ;(getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(profile)
  })

  it('trocar o tipo na edição converte depósito em levantamento e ajusta a reserva', async () => {
    const { getProfile, updateTransaction, updateFinancialGoals } = await import('@/lib/supabase')
    ;(getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ ...profile, fin_current_savings: 500 })
    await renderPage()
    // abre o depósito recente de Poupança (t5: entrada, 150) e troca para saída
    fireEvent.click(screen.getByText('Poupança'))
    fireEvent.click(screen.getByText('↑ Saída'))
    fireEvent.click(screen.getByText('Guardar alterações'))
    await waitFor(() => expect(updateTransaction).toHaveBeenCalled())
    expect((updateTransaction as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1]).toMatchObject({ type: 'saida', category: 'Poupança', amount: 150 })
    // reserva: 500 + (−150 levantamento) − (+150 depósito original) = 200
    await waitFor(() => expect(updateFinancialGoals).toHaveBeenCalledWith('u1', { fin_current_savings: 200 }))
    ;(getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(profile)
  })

  it('ativa o lembrete diário criando um reminder das finanças', async () => {
    const { getReminders, saveReminder } = await import('@/lib/supabase')
    ;(getReminders as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await renderPage()
    fireEvent.click(screen.getByLabelText('Mais opções'))
    expect(screen.getByText('desligado')).toBeDefined()
    fireEvent.click(screen.getByText('🔔 Lembrete diário'))
    await waitFor(() => expect(saveReminder).toHaveBeenCalled())
    const payload = (saveReminder as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0]
    expect(payload).toMatchObject({ user_id: 'u1', type: 'financas', time: '21:00' })
    expect(payload.days).toEqual([0,1,2,3,4,5,6])
  })

  it('mostra o lembrete como ativo quando já existe', async () => {
    const { getReminders } = await import('@/lib/supabase')
    ;(getReminders as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'rem1', type: 'financas' }])
    await renderPage()
    fireEvent.click(screen.getByLabelText('Mais opções'))
    expect(screen.getByText('às 21:00')).toBeDefined()
  })

  it('abre o feed completo de insights e inclui a maior despesa fixa', async () => {
    await renderPage()
    // há >1 insight (orçamento de Lazer + maior despesa fixa recorrente…)
    const verTodos = await screen.findByText(/Ver todos \d+ ›/)
    fireEvent.click(verTodos)
    // o sheet lista todos, incluindo o insight das recorrentes (Habitação 650)
    expect(await screen.findByText(/maior despesa fixa é Habitação/)).toBeDefined()
  })

  it('abre o fecho do mês anterior quando ainda não foi visto', async () => {
    localStorage.removeItem('nexus_monthclose_seen_u1')
    await renderPage()
    // junho: entradas 1000, gastos 200 → balanço +800
    expect(await screen.findByText(/Fecho de Junho 2026/)).toBeDefined()
    expect(screen.getByText(/Começar julho ›/)).toBeDefined()
    // dispensar guarda o mês como visto
    fireEvent.click(screen.getByText(/Começar julho ›/))
    await waitFor(() => expect(screen.queryByText(/Fecho de Junho 2026/)).toBeNull())
    expect(localStorage.getItem('nexus_monthclose_seen_u1')).toBe('2026-06')
  })
})
