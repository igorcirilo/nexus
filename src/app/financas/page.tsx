'use client'
// src/app/financas/page.tsx
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import Nav from '@/components/Nav'
import {
  requireUser, getProfile, getTransactions,
  getTransactionsByMonth, getAllTransactions, getTransactionsForMonth, searchTransactions,
  saveTransaction, updateTransaction,
  saveTransactionsBulk, deleteTransaction, updateFinancialGoals, updateBudgets,
  getRecurringRules, saveRecurringRule, updateRecurringRule, deleteRecurringRule,
  getReminders, saveReminder, deleteReminder,
} from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  parseCsvText, detectColumnMap, rowsToTransactions,
  type TransactionCandidate,
} from '@/lib/csv-parser'
import {
  monthlySavings, buildBudgetSummary, categoryTotals, sumInRange,
  unbudgetedSpend, buildInsights,
  pendingRecurrences, recurringMonthlyTotal,
  buildMonthSummary, monthCloseHeadline, loggingStreak, detectAnomalies, carryIn,
} from '@/lib/finance'
import { suggestCategory } from '@/lib/categorize'
import { extractPdfText, parseStatementPdf } from '@/lib/pdf'
import { logError } from '@/lib/log'
import { darkCardInk } from '@/lib/theme'
import {
  CATEGORIES_IN, CATEGORIES_OUT, CAT_COLORS, SAVINGS_CAT, CUSTOM_KEY, catEmoji,
} from '@/lib/categories'
import { Sheet, StepChips, sheetLabel, sheetInp } from '@/components/financas/Sheet'
import { format, startOfMonth, endOfMonth, subMonths, subDays, addMonths, getDaysInMonth, getDate } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile, Transaction, RecurringRule, FinancialImportPreview, FinancialImportCandidate } from '@/types'

// Cores de gráfico validadas (luminosidade, croma, separação CVD e contraste)
// contra as superfícies dos dois temas (#11131C escuro / #FFFFFF claro).
const CHART_IN  = '#00A87E'
const CHART_OUT = '#E24B4A'
const CHART_CAT = '#7F77DD'
// Tipo do lembrete diário de registo (o edge function envia-o à hora/dias e
// aponta a notificação para /financas).
const LOG_REMINDER_TYPE = 'financas'
const LOG_REMINDER_TIME = '21:00'
const fmt = (v:number) => v.toLocaleString('pt-PT',{style:'currency',currency:'EUR'})

function dayLabel(date:string) {
  const today = format(new Date(),'yyyy-MM-dd')
  const yest  = format(subDays(new Date(),1),'yyyy-MM-dd')
  if (date===today) return 'Hoje'
  if (date===yest)  return 'Ontem'
  const s = format(new Date(date+'T12:00:00'),'EEE, d MMM',{locale:pt})
  return s.charAt(0).toUpperCase()+s.slice(1)
}

// Sem orçamentos por defeito: um utilizador novo só vê valores que ele próprio
// definiu. As sugestões vêm da média real dos últimos 3 meses (catAvg3m).

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg2)', border:'0.5px solid var(--border)',
  borderRadius:12, padding:'11px 14px', color:'var(--text1)',
  fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none',
}
const hubInp: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)',
  border: '1px solid rgba(var(--ink-rgb),0.08)',
  borderRadius: 12, padding: '11px 14px', color: 'var(--ink)',
  fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
}
const TT: React.CSSProperties = {
  background:'var(--bg2)', border:'0.5px solid rgba(var(--ink-rgb),.1)', borderRadius:10, color:'var(--text1)', fontSize:12,
}

export default function FinancasPage() {
  const toast = useToast()
  const [profile,    setProfile]   = useState<Profile|null>(null)
  const [txs,        setTxs]       = useState<Transaction[]>([])
  const [history,    setHistory]   = useState<Transaction[]>([])
  const [userId,     setUserId]    = useState<string|null>(null)
  const [moreOpen,   setMoreOpen] = useState(false)
  const [showMovimentos, setShowMovimentos] = useState(false)
  const [showOrcamento,  setShowOrcamento]  = useState(false)
  const [loading,    setLoading]   = useState(true)
  const [budgets,    setBudgets]   = useState<Record<string,number>>({})
  // Form transação
  const [showForm,   setShowForm]  = useState(false)
  const [txType,     setTxType]    = useState<'entrada'|'saida'>('saida')
  const [fCat,       setFCat]      = useState('')
  const [fCustomCat, setFCustomCat]= useState('')
  const [fDesc,      setFDesc]     = useState('')
  const [fAmount,    setFAmount]   = useState('')
  const [fDate,      setFDate]     = useState(format(new Date(),'yyyy-MM-dd'))
  const [saving,     setSaving]    = useState(false)
  // Metas: sheet por meta
  const [metaSheet,  setMetaSheet] = useState<'reserva'|'poupanca'|null>(null)
  const [gSave,      setGSave]     = useState('')
  const [gReserve,   setGReserve]  = useState('')
  const [gCurrent,   setGCurrent]  = useState('')
  const [gSaving,    setGSaving]   = useState(false)
  // Orçamento: sheet por categoria
  const [budgetSheet,setBudgetSheet]= useState<string|null>(null)
  const [budgetVal,  setBudgetVal] = useState('')
  // Movimentos: pesquisa, filtros e sheet de detalhe
  const [txQuery,    setTxQuery]   = useState('')
  const [txFilter,   setTxFilter]  = useState<'all'|'entrada'|'saida'>('all')
  const [txCat,      setTxCat]     = useState<string|null>(null)
  // Navegação por mês (sob demanda) + pesquisa em todo o histórico
  const [monthCursor,  setMonthCursor]  = useState<Date>(() => startOfMonth(new Date()))
  const [monthCache,   setMonthCache]   = useState<Record<string, Transaction[]>>({})
  const [monthLoading, setMonthLoading] = useState(false)
  const [searchResults,setSearchResults]= useState<Transaction[]|null>(null)
  const [searchLoading,setSearchLoading]= useState(false)
  const [openTx,     setOpenTx]    = useState<Transaction|null>(null)
  const [etType,     setEtType]    = useState<'entrada'|'saida'>('saida')
  const [etCat,      setEtCat]     = useState('')
  const [etDesc,     setEtDesc]    = useState('')
  const [etAmount,   setEtAmount]  = useState('')
  const [etDate,     setEtDate]    = useState('')
  const [txEditSaving, setTxEditSaving] = useState(false)
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction|null>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const [csvPreview, setCsvPreview]     = useState<TransactionCandidate[] | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [pdfPreview, setPdfPreview] = useState<FinancialImportPreview | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [exporting, setExporting]   = useState(false)
  // Recorrentes
  const [recurring,      setRecurring]      = useState<RecurringRule[]>([])
  const [recurringSkips, setRecurringSkips] = useState<string[]>([])
  const [showRecorrentes,setShowRecorrentes]= useState(false)
  const [showInsights,   setShowInsights]   = useState(false)
  const [postingRuleId,  setPostingRuleId]  = useState<string|null>(null)
  const [fRepeat,        setFRepeat]        = useState(false)
  // Fecho do mês: guarda o último mês cujo resumo já foi dispensado (yyyy-MM).
  const [monthCloseSeen, setMonthCloseSeen] = useState<string|null>(null)
  const [monthCloseOpen, setMonthCloseOpen] = useState(false)
  // Lembrete diário de registo (ids das linhas de reminders do tipo 'financas').
  const [logReminderIds, setLogReminderIds] = useState<string[]>([])
  const [reminderBusy, setReminderBusy] = useState(false)

  function showToast(m: string, type: 'success' | 'error' | 'info' = 'success') {
    if (type === 'error') toast.error(m)
    else toast.success(m)
  }

  useEffect(() => {
    requireUser().then(async (user) => {
      if (!user) return
      setUserId(user.id)
      const [prof, recent, hist, rules, reminders] = await Promise.all([
        getProfile(user.id),
        getTransactions(user.id, 2),
        getTransactionsByMonth(user.id, 6),
        getRecurringRules(user.id),
        getReminders(user.id),
      ])
      setProfile(prof)
      setTxs(recent as Transaction[])
      setHistory(hist as Transaction[])
      setRecurring(rules as RecurringRule[])
      setLogReminderIds((reminders as { id:string; type:string }[]).filter(r => r.type===LOG_REMINDER_TYPE).map(r => r.id))
      // Recorrências saltadas neste mês vivem só no dispositivo (não é dado
      // crítico e evita mais uma tabela); chave `${ruleId}:${yyyy-MM}`.
      try {
        const s = localStorage.getItem(`nexus_recurring_skips_${user.id}`)
        if (s) setRecurringSkips(JSON.parse(s))
      } catch {}
      try {
        setMonthCloseSeen(localStorage.getItem(`nexus_monthclose_seen_${user.id}`))
      } catch {}
      // Orçamentos: fonte de verdade no Supabase (profiles.fin_budgets). O
      // localStorage é só cache offline; se houver dados só-locais (versão
      // antiga), migram-se para o Supabase neste primeiro carregamento.
      const dbBudgets = (prof?.fin_budgets ?? null) as Record<string, number> | null
      let localBudgets: Record<string, number> | null = null
      try {
        const saved = localStorage.getItem(`nexus_budgets_${user.id}`)
        if (saved) localBudgets = JSON.parse(saved)
      } catch {}
      if (dbBudgets && Object.keys(dbBudgets).length > 0) {
        setBudgets(dbBudgets)
        try { localStorage.setItem(`nexus_budgets_${user.id}`, JSON.stringify(dbBudgets)) } catch {}
      } else if (localBudgets && Object.keys(localBudgets).length > 0) {
        setBudgets(localBudgets)
        updateBudgets(user.id, localBudgets)
      }
      setLoading(false)

    })
  }, [])

  // Recarrega movimentos recentes (2m) + histórico (6m) após cada mutação.
  // Fonte única: garante que tanto as listas como os gráficos de 6 meses ficam
  // consistentes (o `history` não traz `id`, por isso não dá para filtrar local).
  async function reloadTx(uid: string) {
    const [r, h] = await Promise.all([getTransactions(uid, 2), getTransactionsByMonth(uid, 6)])
    setTxs(r as Transaction[])
    setHistory(h as Transaction[])
    // Invalida as caches do sheet de movimentos para refletir a mutação.
    setMonthCache({})
    setSearchResults(null)
  }
  async function reloadRecurring(uid: string) {
    setRecurring(await getRecurringRules(uid) as RecurringRule[])
  }

  // A reserva (fin_current_savings) segue os movimentos de "Poupança":
  // depositar (entrada) soma, levantar (saída) subtrai; apagar/editar ajusta
  // pela diferença. Fica sempre corrigível à mão no cartão da reserva.
  async function bumpSavings(uid: string, delta: number) {
    if (!delta) return
    const next = Math.max(0, (profile?.fin_current_savings ?? 0) + delta)
    await updateFinancialGoals(uid, { fin_current_savings: next })
    setProfile(await getProfile(uid))
  }
  const savingsDelta = (type: 'entrada'|'saida', cat: string, amount: number) =>
    cat === SAVINGS_CAT ? (type === 'entrada' ? amount : -amount) : 0

  // Métricas do mês atual
  const monthStart = format(startOfMonth(new Date()),'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),'yyyy-MM-dd')
  const thisMonth  = useMemo(()=>txs.filter(t=>t.date>=monthStart&&t.date<=monthEnd),[txs,monthStart,monthEnd])
  // Entradas = RENDIMENTO real. Uma entrada "Poupança" é um depósito na
  // reserva (transferência), não rendimento → fica fora das entradas/balanço.
  const totalIn    = useMemo(()=>thisMonth.filter(t=>t.type==='entrada'&&t.category!==SAVINGS_CAT).reduce((a,t)=>a+t.amount,0),[thisMonth])
  // Saídas = GASTO real. Uma saída "Poupança" é um levantamento da reserva
  // (transferência), não consumo → fica fora das saídas e do balanço.
  const totalOut   = useMemo(()=>thisMonth.filter(t=>t.type==='saida'&&t.category!==SAVINGS_CAT).reduce((a,t)=>a+t.amount,0),[thisMonth])
  const balance    = totalIn - totalOut
  // Histórico sem as transferências de/para poupança, para os gráficos e médias
  // não tratarem poupar como gasto nem levantar como rendimento.
  const historyNoSavings = useMemo(()=>history.filter(t=>t.category!==SAVINGS_CAT),[history])

  const dayOfMonth  = getDate(new Date())
  const daysInMonth = getDaysInMonth(new Date())
  const daysLeft    = daysInMonth - dayOfMonth

  // Categorias de saída personalizadas: qualquer categoria que apareça nos
  // movimentos mas não esteja na lista base (ex.: criada via "Personalizar").
  // Assim entram no orçamento e nos filtros como cidadãs de primeira classe.
  const customOutCats = useMemo(() => {
    const known = new Set([...CATEGORIES_OUT, ...CATEGORIES_IN])
    const found = new Set<string>()
    ;[...txs, ...history].forEach(t => { if (t.type === 'saida' && !known.has(t.category)) found.add(t.category) })
    return Array.from(found).sort()
  }, [txs, history])
  // Lista de categorias de saída usada em orçamento/listas, com "Outro" sempre no fim.
  const OUT_CATS = useMemo(
    () => [...CATEGORIES_OUT.filter(c => c !== 'Outro'), ...customOutCats, 'Outro'],
    [customOutCats],
  )
  // Categorias orçamentáveis: as de saída SEM "Poupança" — um levantamento da
  // reserva é transferência, não consumo, por isso não entra no gauge, nas
  // sugestões nem nas médias do orçamento.
  const BUDGET_CATS = useMemo(() => OUT_CATS.filter(c => c !== SAVINGS_CAT), [OUT_CATS])

  // Gráfico 6 meses. `poupanca` = o que sobrou (entradas − saídas, sem
  // transferências); `poupado` = líquido movido para a reserva (depósitos −
  // levantamentos de "Poupança") — a mesma definição do cartão "Poupado" e da
  // meta mensal, para todos os sítios que falam de "poupar" baterem certo.
  const monthlyChart = useMemo(()=>{
    const months = Array.from({length:6},(_,i)=>subMonths(new Date(),5-i))
    const ranges = months.map(d=>({start:format(startOfMonth(d),'yyyy-MM-dd'),end:format(endOfMonth(d),'yyyy-MM-dd')}))
    const series = monthlySavings(historyNoSavings, ranges)
    const saved  = monthlySavings(history.filter(t=>t.category===SAVINGS_CAT), ranges)
    return months.map((d,i)=>({label:format(d,'MMM',{locale:pt}),...series[i],poupado:saved[i].poupanca}))
  },[history,historyNoSavings])

  // ── Médias dos últimos 3 meses completos (exclui o mês atual) ──
  const prev3Range = useMemo(() => ({
    start: format(startOfMonth(subMonths(new Date(),3)),'yyyy-MM-dd'),
    end:   format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'),
  }), [])
  const avgExpenses3m = useMemo(() => {
    const out = historyNoSavings.filter(t => t.type==='saida' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .reduce((a,t)=>a+t.amount,0)
    return out/3
  }, [historyNoSavings, prev3Range])
  const avgIncome3m = useMemo(() => {
    const inc = historyNoSavings.filter(t => t.type==='entrada' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .reduce((a,t)=>a+t.amount,0)
    return inc/3
  }, [historyNoSavings, prev3Range])
  const catAvg3m = useMemo(() => {
    const map: Record<string,number> = {}
    historyNoSavings.filter(t => t.type==='saida' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .forEach(t => { map[t.category]=(map[t.category]??0)+t.amount })
    Object.keys(map).forEach(k => { map[k]=map[k]/3 })
    return map
  }, [historyNoSavings, prev3Range])
  // Gasto por categoria nos últimos 4 meses (3 anteriores + atual) para sparkline
  const catMonthly = useMemo(() => {
    const map: Record<string,number[]> = {}
    for (let i=3;i>=0;i--) {
      const d=subMonths(new Date(),i)
      const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
      const inMonth = historyNoSavings.filter(t=>t.type==='saida'&&t.date>=s&&t.date<=e)
      const perCat: Record<string,number> = {}
      inMonth.forEach(t=>{ perCat[t.category]=(perCat[t.category]??0)+t.amount })
      BUDGET_CATS.forEach(c=>{ (map[c] ??= []).push(Math.round(perCat[c]??0)) })
    }
    return map
  }, [historyNoSavings, BUDGET_CATS])

  // ── Movimentos: mês selecionado vs. pesquisa em todo o histórico ──
  // Pesquisa com ≥2 caracteres → resultados globais (server-side); caso
  // contrário → transações do mês do cursor (carregadas sob demanda). O mês
  // corrente é servido de imediato por `txs` para não piscar ao abrir.
  const searchMode  = txQuery.trim().length >= 2
  const cursorKey   = format(monthCursor, 'yyyy-MM')
  const nowMonthKey = format(startOfMonth(new Date()), 'yyyy-MM')
  const isCurrentMonthCursor = cursorKey === nowMonthKey
  const sheetSourceTxs = useMemo(() => {
    if (searchMode) return searchResults ?? []
    if (isCurrentMonthCursor && !monthCache[cursorKey]) return thisMonth
    return monthCache[cursorKey] ?? []
  }, [searchMode, searchResults, isCurrentMonthCursor, monthCache, cursorKey, thisMonth])
  const filteredTxs = useMemo(() => sheetSourceTxs.filter(t =>
    (txFilter==='all' || t.type===txFilter) &&
    (!txCat || t.category===txCat)
  ), [sheetSourceTxs, txFilter, txCat])
  const txGroups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    filteredTxs.forEach(t => {
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    })
    return Array.from(map.entries()).sort((a,b)=>b[0].localeCompare(a[0]))
  }, [filteredTxs])
  const txCatOptions = useMemo(() => {
    const counts: Record<string,number> = {}
    sheetSourceTxs.forEach(t => { counts[t.category]=(counts[t.category]??0)+1 })
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c])=>c)
  }, [sheetSourceTxs])
  const filterActive = txFilter!=='all' || !!txCat || searchMode
  const filteredTotal = filteredTxs.reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0)
  const sheetBusy = searchMode ? searchLoading : monthLoading

  // Carrega o mês do cursor sob demanda (exceto o corrente, servido por txs).
  useEffect(() => {
    if (!showMovimentos || !userId || searchMode) return
    const key = format(monthCursor, 'yyyy-MM')
    if (monthCache[key] || key === nowMonthKey) return
    setMonthLoading(true)
    const s = format(startOfMonth(monthCursor), 'yyyy-MM-dd')
    const e = format(endOfMonth(monthCursor), 'yyyy-MM-dd')
    getTransactionsForMonth(userId, s, e).then(rows => {
      setMonthCache(c => ({ ...c, [key]: rows as Transaction[] }))
      setMonthLoading(false)
    })
  }, [showMovimentos, userId, monthCursor, searchMode, monthCache, nowMonthKey])

  // Ao abrir o sheet, começa sempre no mês corrente.
  useEffect(() => {
    if (showMovimentos) setMonthCursor(startOfMonth(new Date()))
  }, [showMovimentos])

  // Pesquisa global (debounced) quando a query tem ≥2 caracteres.
  useEffect(() => {
    if (!showMovimentos || !userId) return
    const q = txQuery.trim()
    if (q.length < 2) { setSearchResults(null); return }
    setSearchLoading(true)
    const t = setTimeout(() => {
      searchTransactions(userId, q).then(rows => {
        setSearchResults(rows as Transaction[]); setSearchLoading(false)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [showMovimentos, userId, txQuery])

  // ── Orçamento: gauge + categorias ordenadas ──
  const spentByCat = useMemo(
    () => categoryTotals(thisMonth, monthStart, monthEnd),
    [thisMonth, monthStart, monthEnd],
  )
  // Poupança do mês = líquido dos lançamentos "Poupança": depósitos (entrada)
  // somam, levantamentos (saída) subtraem. Pode ficar negativa se levantou
  // mais do que depositou.
  const savedThisMonth = useMemo(
    () => thisMonth.filter(t=>t.category===SAVINGS_CAT)
      .reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0),
    [thisMonth],
  )
  // Gasto por categoria SEM Poupança — para insights e "para onde foi o dinheiro"
  // não tratarem uma transferência de poupança como despesa.
  const spendByCatOnly = useMemo(() => {
    const { [SAVINGS_CAT]: _omit, ...rest } = spentByCat
    void _omit
    return rest
  }, [spentByCat])
  const { rows: budgetedCats, unbudgeted: unbudgetedCats, totalBudget, totalSpent: totalSpentBudgeted, pct: budgetPct } =
    buildBudgetSummary(budgets, spentByCat, BUDGET_CATS)
  // Cor do orçamento por quanto já foi usado (sem comparar com o "ritmo" do mês).
  const budgetColor        = budgetPct >= 100 ? '#E24B4A' : budgetPct >= 85 ? '#F5C842' : '#00C896'
  const budgetSuggestions  = BUDGET_CATS
    .filter(c => (catAvg3m[c]??0) > 0)
    .map(c => ({ cat:c, avg:catAvg3m[c], suggested: Math.ceil((catAvg3m[c]*1.05)/10)*10 }))

  // ── Saldo que arrasta do(s) mês(es) anterior(es) ──
  // carryIn = líquido dos meses anteriores; disponível = arrastado + o que
  // sobrou este mês (entradas − gastos − poupança).
  const carryInVal = useMemo(() => carryIn(history, monthStart), [history, monthStart])
  const hasCarry   = useMemo(() => history.some(t => t.date < monthStart), [history, monthStart])
  const available  = carryInVal + balance - savedThisMonth

  // ── Comparação com o mês anterior e insights ──
  // Saídas do mês anterior até ao mesmo dia — comparação justa com o mês parcial.
  const prevSpendToDate = useMemo(() => {
    const prev = subMonths(new Date(), 1)
    return sumInRange(historyNoSavings, 'saida', format(startOfMonth(prev),'yyyy-MM-dd'), format(prev,'yyyy-MM-dd'))
  }, [historyNoSavings])
  const spendDeltaPct = prevSpendToDate > 0 && totalOut > 0
    ? Math.round((totalOut / prevSpendToDate - 1) * 100)
    : null
  const daysSinceLastTx = useMemo(() => {
    const last = [...txs, ...history].reduce<string|null>((m,t) => (!m || t.date > m) ? t.date : m, null)
    if (!last) return null
    const today = format(new Date(),'yyyy-MM-dd')
    const diff = Math.round((new Date(today+'T12:00:00').getTime() - new Date(last+'T12:00:00').getTime()) / 86400000)
    return Math.max(0, diff)
  }, [txs, history])
  // Cobranças incomuns do mês (vs. média por-transação do histórico) e resumo
  // das recorrentes, para alimentar o motor de insights.
  // Baseline = meses ANTERIORES (history inclui o mês corrente; se a própria
  // cobrança entrasse na média, escondia-se a si mesma).
  const anomalies = useMemo(
    () => detectAnomalies(thisMonth, history.filter(t => t.date < monthStart), { savingsCat: SAVINGS_CAT }),
    [thisMonth, history, monthStart],
  )
  const { subscriptionsMonthly, topRecurring } = useMemo(() => {
    const activeOut = recurring.filter(r => r.active && r.type === 'saida')
    const subs = activeOut.filter(r => r.category === 'Assinaturas').reduce((a,r)=>a+r.amount,0)
    const top = activeOut.slice().sort((a,b)=>b.amount-a.amount)[0]
    return { subscriptionsMonthly: subs, topRecurring: top ? { cat: top.category, amount: top.amount } : null }
  }, [recurring])
  const insights = useMemo(() => buildInsights({
    spentByCat: spendByCatOnly,
    catAvg3m,
    budgets,
    savingsPrevMonth: monthlyChart.length >= 2 ? monthlyChart[monthlyChart.length-2].poupado : 0,
    savingsThisMonth: savedThisMonth,
    daysSinceLastTx,
    topAnomaly: anomalies[0] ?? null,
    subscriptionsMonthly,
    topRecurring,
  }, fmt), [spendByCatOnly, catAvg3m, budgets, monthlyChart, savedThisMonth, daysSinceLastTx, anomalies, subscriptionsMonthly, topRecurring])
  const topInsight = insights[0] ?? null
  // Gasto do mês que o gauge do orçamento não vê (Poupança não é consumo).
  const outsideBudget = unbudgetedSpend(spentByCat, budgets, [SAVINGS_CAT])

  // ── Visão geral: top categorias do mês + série de 6 meses ──
  const catBreakdown = useMemo(() => {
    const entries = Object.entries(spendByCatOnly).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])
    const top   = entries.slice(0,5).map(([cat,v]) => ({ cat, v }))
    const rest  = entries.slice(5).reduce((a,[,v]) => a+v, 0)
    const total = entries.reduce((a,[,v]) => a+v, 0)
    return { rows: rest > 0 ? [...top, { cat:'Outros', v:rest }] : top, total }
  }, [spendByCatOnly])
  const hasHistory = monthlyChart.some(m => m.entradas > 0 || m.saidas > 0)

  // ── Recorrentes: pendentes do mês + totais ──
  const monthKey = format(new Date(),'yyyy-MM')
  const pendingRules = useMemo(
    () => pendingRecurrences(
      recurring,
      thisMonth.map(t => t.recurring_id),
      dayOfMonth,
      monthKey,
      recurringSkips,
    ),
    [recurring, thisMonth, dayOfMonth, monthKey, recurringSkips],
  )
  const recurringOutTotal = recurringMonthlyTotal(recurring, 'saida')
  const recurringInTotal  = recurringMonthlyTotal(recurring, 'entrada')

  // ── Sequência de registo (hábito diário) ──
  const logStreak = useMemo(
    () => loggingStreak([...txs, ...history].map(t=>t.date), format(new Date(),'yyyy-MM-dd')),
    [txs, history],
  )
  const dailyReminderOn = logReminderIds.length > 0
  async function toggleDailyReminder() {
    if (!userId || reminderBusy) return
    setReminderBusy(true)
    setMoreOpen(false)
    if (dailyReminderOn) {
      await Promise.all(logReminderIds.map(id => deleteReminder(id)))
      showToast('Lembrete diário desativado.')
    } else {
      await saveReminder({
        user_id: userId,
        title: 'Registar gastos',
        description: '30 segundos: regista os gastos de hoje 💸',
        time: LOG_REMINDER_TIME,
        days: [0,1,2,3,4,5,6],
        type: LOG_REMINDER_TYPE,
        active: true,
      })
      showToast('Lembrete diário às 21:00 ativado.')
    }
    const reminders = await getReminders(userId) as { id:string; type:string }[]
    setLogReminderIds(reminders.filter(r=>r.type===LOG_REMINDER_TYPE).map(r=>r.id))
    setReminderBusy(false)
  }

  // ── Fecho do mês: resumo do mês anterior (mostra uma vez por mês) ──
  const prevMonthKey = format(subMonths(new Date(),1),'yyyy-MM')
  const monthClose = useMemo(() => {
    const prev  = subMonths(new Date(),1)
    const prev2 = subMonths(new Date(),2)
    const cur  = buildMonthSummary(history, format(startOfMonth(prev),'yyyy-MM-dd'),  format(endOfMonth(prev),'yyyy-MM-dd'),  SAVINGS_CAT)
    const before = buildMonthSummary(history, format(startOfMonth(prev2),'yyyy-MM-dd'), format(endOfMonth(prev2),'yyyy-MM-dd'), SAVINGS_CAT)
    return { cur, before, label: format(prev,'MMMM yyyy',{locale:pt}).replace(/^./,c=>c.toUpperCase()) }
  }, [history])
  const monthCloseHasData = monthClose.cur.income>0 || monthClose.cur.spending>0 || monthClose.cur.saved>0
  // Abre automaticamente quando há um mês fechado por rever (e não foi dispensado).
  const shouldShowMonthClose = !loading && monthCloseHasData && monthCloseSeen !== prevMonthKey
  useEffect(() => { if (shouldShowMonthClose) setMonthCloseOpen(true) }, [shouldShowMonthClose])
  function dismissMonthClose() {
    setMonthCloseOpen(false)
    setMonthCloseSeen(prevMonthKey)
    if (userId) try { localStorage.setItem(`nexus_monthclose_seen_${userId}`, prevMonthKey) } catch {}
  }

  function openTxSheet(t: Transaction) {
    setOpenTx(t)
    setEtType(t.type); setEtCat(t.category); setEtDesc(t.description ?? '')
    setEtAmount(String(t.amount)); setEtDate(t.date)
  }

  async function saveTxEdit() {
    if (!openTx || !userId) return
    const amount = parseFloat(etAmount.replace(',','.'))
    if (!Number.isFinite(amount) || amount<=0 || !etCat || !etDate) return
    setTxEditSaving(true)
    const { error } = await updateTransaction(openTx.id, {
      type: etType, category: etCat, description: etDesc.trim()||null, amount, date: etDate,
    })
    if (error) { showToast('Erro ao guardar.', 'error'); setTxEditSaving(false); return }
    // Ajusta a reserva pela diferença de poupança (tipo e categoria podem mudar
    // na edição: trocar depósito ↔ levantamento inverte o sinal).
    await bumpSavings(userId,
      savingsDelta(etType, etCat, amount) - savingsDelta(openTx.type, openTx.category, openTx.amount))
    await reloadTx(userId)
    setOpenTx(null); setTxEditSaving(false); showToast('Movimento atualizado!')
  }

  async function removeTxConfirmed() {
    if (!confirmDeleteTx || !userId) return
    const tx = confirmDeleteTx
    await removeTx(tx.id)
    await bumpSavings(userId, -savingsDelta(tx.type, tx.category, tx.amount))
    setConfirmDeleteTx(null)
    setOpenTx(null)
  }

  function stepValue(cur: string, delta: number, set: (v:string)=>void) {
    const n = parseFloat(cur.replace(',','.'))
    set(String(Math.max(0, (Number.isFinite(n)?n:0) + delta)))
  }

  async function saveMeta() {
    if (!userId || !metaSheet) return
    setGSaving(true)
    await updateFinancialGoals(userId, metaSheet==='reserva'
      ? { fin_reserve_goal: gReserve?parseFloat(gReserve):undefined, fin_current_savings: gCurrent?parseFloat(gCurrent):undefined }
      : { fin_monthly_save: gSave?parseFloat(gSave):undefined }
    )
    setProfile(await getProfile(userId))
    setMetaSheet(null); showToast('Meta atualizada!'); setGSaving(false)
  }

  async function addTx() {
    const finalCat = fCat===CUSTOM_KEY ? fCustomCat.trim() : fCat
    if (!userId||!fAmount||!finalCat) return
    const amount = parseFloat(fAmount.replace(',','.'))
    if (!Number.isFinite(amount) || amount<=0) { showToast('Valor inválido.', 'error'); return }
    setSaving(true)
    const {error} = await saveTransaction({user_id:userId,type:txType,category:finalCat,description:fDesc||null,amount,date:fDate})
    if (error) { showToast('Erro ao guardar.', 'error'); setSaving(false); return }
    // "Repetir todos os meses": cria também a regra recorrente com o dia do mês
    // da transação (limitado a 1–28 para existir em qualquer mês).
    if (fRepeat) {
      const day = Math.min(28, Math.max(1, Number(fDate.slice(8,10)) || 1))
      const { error: rErr } = await saveRecurringRule({
        user_id:userId, type:txType, category:finalCat, description:fDesc||null, amount, day_of_month:day, active:true,
      })
      if (rErr) showToast('Movimento guardado, mas não consegui criar a recorrência.', 'error')
      else await reloadRecurring(userId)
    }
    await bumpSavings(userId, savingsDelta(txType, finalCat, amount))
    await reloadTx(userId)
    setFAmount(''); setFDesc(''); setFCat(''); setFCustomCat(''); setFRepeat(false); setShowForm(false)
    showToast(fRepeat?'Transação e recorrência criadas!':'Transação adicionada!'); setSaving(false)
  }

  // Lança a transação de uma recorrência pendente, marcada com recurring_id
  // para não voltar a aparecer este mês. Data = dia agendado no mês corrente.
  async function postRecurrence(rule: RecurringRule) {
    if (!userId) return
    setPostingRuleId(rule.id)
    const day  = Math.min(daysInMonth, rule.day_of_month)
    const date = format(new Date(new Date().getFullYear(), new Date().getMonth(), day), 'yyyy-MM-dd')
    const { error } = await saveTransaction({
      user_id:userId, type:rule.type, category:rule.category, description:rule.description,
      amount:rule.amount, date, recurring_id:rule.id,
    })
    setPostingRuleId(null)
    if (error) { showToast('Erro ao lançar. Aplicaste a migração financas_recurring_v1.sql?', 'error'); return }
    await bumpSavings(userId, savingsDelta(rule.type, rule.category, rule.amount))
    await reloadTx(userId)
    showToast(`${rule.category} lançado!`)
  }

  function persistSkips(next: string[]) {
    setRecurringSkips(next)
    if (userId) try { localStorage.setItem(`nexus_recurring_skips_${userId}`, JSON.stringify(next)) } catch {}
  }
  function skipRecurrence(rule: RecurringRule) {
    persistSkips([...recurringSkips, `${rule.id}:${monthKey}`])
  }

  async function toggleRuleActive(rule: RecurringRule) {
    if (!userId) return
    const { error } = await updateRecurringRule(rule.id, { active: !rule.active })
    if (error) { showToast('Erro ao atualizar.', 'error'); return }
    await reloadRecurring(userId)
  }
  async function deleteRule(rule: RecurringRule) {
    if (!userId) return
    const { error } = await deleteRecurringRule(rule.id)
    if (error) { showToast('Erro ao remover.', 'error'); return }
    await reloadRecurring(userId)
    showToast('Recorrência removida.')
  }

  async function removeTx(id:string) {
    const {error}=await deleteTransaction(id)
    if (error || !userId) return
    await reloadTx(userId)
    showToast('Removido.')
  }

  // Persiste no Supabase (fonte de verdade) e mantém o cache local offline.
  function persistBudgets(updated: Record<string,number>) {
    setBudgets(updated)
    if (userId) {
      updateBudgets(userId, updated)
      try { localStorage.setItem(`nexus_budgets_${userId}`,JSON.stringify(updated)) } catch {}
    }
  }

  function saveBudget(cat:string,val:string) {
    const n=parseFloat(val); if (isNaN(n)||n<0) return
    persistBudgets({...budgets,[cat]:n})
    showToast('Orçamento guardado.')
  }

  // Exporta todo o histórico no mesmo formato que a importação aceita
  // (data,tipo,categoria,valor,descricao) — os dados nunca ficam presos no app.
  async function exportCSV() {
    if (!userId || exporting) return
    setExporting(true)
    try {
      const all = await getAllTransactions(userId) as Pick<Transaction,'date'|'type'|'category'|'amount'|'description'>[]
      if (all.length === 0) { showToast('Sem movimentos para exportar.', 'error'); return }
      const esc = (s:string) => /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
      const lines = [
        'data,tipo,categoria,valor,descricao',
        ...all.map(t => [t.date, t.type, esc(t.category), String(t.amount), esc(t.description ?? '')].join(',')),
      ]
      // BOM para o Excel abrir acentos corretamente.
      const blob = new Blob(['\uFEFF'+lines.join('\n')], { type:'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `nexus-financas-${format(new Date(),'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${all.length} movimentos exportados.`)
    } finally {
      setExporting(false)
    }
  }

  function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsvText(text)
      if (rows.length === 0) { showToast('CSV sem dados reconhecidos.', 'error'); return }
      const map = detectColumnMap(headers)
      const candidates = rowsToTransactions(rows, map)
      if (candidates.length === 0) { showToast('Não foi possível interpretar o CSV. Verifica o formato.', 'error'); return }
      setCsvPreview(candidates)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function confirmCsvImport() {
    if (!csvPreview || !userId) return
    setCsvImporting(true)
    const payloads = csvPreview.map(t => ({
      user_id:     userId,
      date:        t.date,
      type:        t.type,
      category:    t.category || 'Outro',
      amount:      t.amount,
      description: t.description || null,
    }))
    const { error } = await saveTransactionsBulk(payloads)
    if (error) { showToast('Erro ao importar transações.', 'error'); setCsvImporting(false); return }
    const savedSum = csvPreview.reduce((a,t)=>a+savingsDelta(t.type, t.category||'Outro', t.amount),0)
    await bumpSavings(userId, savedSum)
    await reloadTx(userId)
    showToast(`${csvPreview.length} transações importadas!`)
    setCsvPreview(null)
    setCsvImporting(false)
  }

  async function importPDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPdfLoading(true)
    try {
      const extracted = await extractPdfText(file)
      const preview = parseStatementPdf(extracted)
      if (preview.candidates.length === 0) {
        showToast('Não encontrei movimentos neste PDF. Tenta um CSV.', 'error')
      } else {
        setPdfPreview(preview)
      }
    } catch (err) {
      showToast('Erro ao ler o PDF.', 'error')
      logError('financas: importar PDF', err)
    } finally {
      setPdfLoading(false)
    }
  }

  async function confirmPdfImport() {
    if (!userId || !pdfPreview) return
    const selected = pdfPreview.candidates.filter(c => c.selected)
    if (selected.length === 0) { showToast('Seleciona pelo menos uma transação.', 'error'); return }
    setCsvImporting(true)
    const rows = selected.map(c => ({
      user_id: userId,
      type: c.type ?? 'saida',
      category: c.category || 'Outro',
      description: c.description || null,
      amount: Math.abs(c.amount ?? 0),
      date: c.date ?? format(new Date(), 'yyyy-MM-dd'),
    }))
    const { error } = await saveTransactionsBulk(rows)
    if (error) { showToast('Erro ao importar.', 'error'); setCsvImporting(false); return }
    const savedSum = rows.reduce((a,r)=>a+savingsDelta(r.type, r.category, r.amount),0)
    await bumpSavings(userId, savedSum)
    await reloadTx(userId)
    setPdfPreview(null)
    setCsvImporting(false)
    showToast(`${rows.length} transações importadas!`)
  }

  const savingsGoal    = profile?.fin_monthly_save    ?? 0
  const reserveGoal    = profile?.fin_reserve_goal    ?? 0
  const currentSavings = profile?.fin_current_savings ?? 0

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <div style={{fontFamily:'Syne, sans-serif',color:'var(--text3)'}}>a carregar…</div>
    </div>
  )


  return (
    <main style={{paddingBottom:'calc(150px + env(safe-area-inset-bottom))',minHeight:'100dvh',background:'var(--surface-page)',fontFamily:'Inter, sans-serif'}}>

      {csvPreview && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:9000,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'var(--bg1)',borderRadius:'20px 20px 0 0',padding:'24px 20px',width:'100%',maxHeight:'80vh',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:16,color:'var(--text1)'}}>
              Pré-visualização — {csvPreview.length} transações
            </div>
            <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:6}}>
              {csvPreview.slice(0,20).map((t,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'var(--bg2)',borderRadius:10,fontSize:13}}>
                  <div>
                    <span style={{color:t.type==='entrada'?'#1D9E75':'#E24B4A',fontWeight:600}}>
                      {t.type==='entrada'?'+':'-'}{fmt(t.amount)}
                    </span>
                    <span style={{color:'var(--text3)',marginLeft:8}}>{t.category}</span>
                  </div>
                  <span style={{color:'var(--text3)',fontSize:12}}>{t.date}</span>
                </div>
              ))}
              {csvPreview.length>20&&(
                <div style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:8}}>+{csvPreview.length-20} mais...</div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setCsvPreview(null)} style={{flex:1,background:'var(--bg3)',color:'var(--text2)',border:'none',borderRadius:12,padding:13,fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
              <button onClick={confirmCsvImport} disabled={csvImporting} style={{flex:2,background:'var(--gold)',color:'var(--on-bright)',border:'none',borderRadius:12,padding:13,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer',opacity:csvImporting?.6:1}}>
                {csvImporting?'A importar...':`Importar ${csvPreview.length} transações`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfPreview && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setPdfPreview(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--bg1)', borderRadius: '20px 20px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 20px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text1)', margin: 0 }}>Movimentos encontrados</p>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '3px 0 0' }}>
                  {pdfPreview.candidates.filter(c => c.selected).length} de {pdfPreview.candidates.length} selecionados
                </p>
              </div>
              <button onClick={() => setPdfPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 22 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
              {pdfPreview.warnings.map((w, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--gold)', margin: '0 0 8px' }}>⚠ {w}</p>
              ))}
              {pdfPreview.candidates.map((c: FinancialImportCandidate, idx) => (
                <div
                  key={c.id}
                  onClick={() => setPdfPreview(prev => prev ? {
                    ...prev,
                    candidates: prev.candidates.map((x, i) => i === idx ? { ...x, selected: !x.selected } : x),
                  } : null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', opacity: c.selected ? 1 : 0.45 }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: c.selected ? 'var(--teal)' : 'var(--bg2)', border: c.selected ? 'none' : '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', fontSize: 11, fontWeight: 700 }}>
                    {c.selected ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>
                      {c.date ?? '—'} · {c.category}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, flexShrink: 0, color: c.type === 'entrada' ? 'var(--teal)' : '#E24B4A' }}>
                    {c.type === 'entrada' ? '+' : '−'}{c.amount?.toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
              <button
                disabled={csvImporting}
                onClick={confirmPdfImport}
                style={{ width: '100%', padding: 14, background: 'var(--teal)', color: 'var(--on-accent)', border: 'none', borderRadius: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              >
                {csvImporting ? 'A importar…' : `Importar ${pdfPreview.candidates.filter(c => c.selected).length} transações`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header: título + menu de importação + registar ── */}
      <div style={{padding:'28px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1 style={{fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:28,marginBottom:3,color: 'var(--ink)',letterSpacing:'-0.5px'}}>Finanças</h1>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <p style={{fontSize:12,color:'var(--text2)'}}>{format(new Date(),'MMMM yyyy',{locale:pt})}</p>
            {logStreak.current>0&&(
              <span
                title={logStreak.loggedToday?'Registaste hoje — sequência garantida':'Regista um movimento hoje para manter a sequência'}
                style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:800,padding:'3px 8px',borderRadius:20,
                  background:logStreak.loggedToday?'rgba(245,140,40,0.12)':'rgba(var(--ink-rgb),0.05)',
                  border:`1px solid ${logStreak.loggedToday?'rgba(245,140,40,0.35)':'rgba(var(--ink-rgb),0.12)'}`,
                  color:logStreak.loggedToday?'#F58C28':'var(--text2)'}}
              >
                🔥 {logStreak.current} dia{logStreak.current!==1?'s':''}{logStreak.loggedToday?'':' · regista hoje'}
              </span>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:8,position:'relative'}}>
          <button
            onClick={()=>setMoreOpen(v=>!v)}
            aria-label="Mais opções"
            aria-expanded={moreOpen}
            style={{width:38,height:38,borderRadius:12,background:moreOpen?'rgba(245,200,66,0.10)':'rgba(var(--ink-rgb),0.05)',border:`1px solid ${moreOpen?'rgba(245,200,66,0.4)':'rgba(var(--ink-rgb),0.08)'}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:moreOpen?'#F5C842':'rgba(var(--ink-rgb),0.6)'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          </button>
          <button
            onClick={()=>setShowForm(true)}
            aria-label="Registar movimento"
            style={{width:38,height:38,borderRadius:12,background:'rgba(245,200,66,0.14)',border:'1px solid rgba(245,200,66,0.35)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#F5C842'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={importCSV}/>
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={importPDF} />

          {moreOpen && (
            <div style={{position:'absolute',right:0,top:46,zIndex:50,width:200,background:'var(--surface-pop)',border:'1px solid rgba(var(--ink-rgb),0.12)',borderRadius:16,boxShadow:'0 18px 50px rgba(0,0,0,0.65)',overflow:'hidden'}}>
              <button onClick={()=>{setMoreOpen(false);csvRef.current?.click()}} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'var(--text1)',background:'transparent',border:'none',borderBottom:'1px solid rgba(var(--ink-rgb),0.06)',cursor:'pointer',textAlign:'left'}}>
                ↑ Importar CSV
              </button>
              <button onClick={()=>{setMoreOpen(false);pdfRef.current?.click()}} disabled={pdfLoading} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'var(--text1)',background:'transparent',border:'none',borderBottom:'1px solid rgba(var(--ink-rgb),0.06)',cursor:'pointer',textAlign:'left'}}>
                📄 {pdfLoading ? 'A ler PDF…' : 'Importar PDF'}
              </button>
              <button onClick={()=>{setMoreOpen(false);setShowRecorrentes(true)}} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'var(--text1)',background:'transparent',border:'none',borderBottom:'1px solid rgba(var(--ink-rgb),0.06)',cursor:'pointer',textAlign:'left'}}>
                🔁 Recorrentes
              </button>
              <button onClick={toggleDailyReminder} disabled={reminderBusy} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'var(--text1)',background:'transparent',border:'none',borderBottom:'1px solid rgba(var(--ink-rgb),0.06)',cursor:'pointer',textAlign:'left'}}>
                🔔 Lembrete diário
                <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:dailyReminderOn?'#00C896':'var(--text3)'}}>{dailyReminderOn?'às 21:00':'desligado'}</span>
              </button>
              <button onClick={()=>{setMoreOpen(false);exportCSV()}} disabled={exporting} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'var(--text1)',background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
                ↓ {exporting ? 'A exportar…' : 'Exportar CSV'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Hero: saldo do mês (toca para ver movimentos) ── */}
      <button
        type="button"
        onClick={()=>{ if(moreOpen){setMoreOpen(false);return} setShowMovimentos(true) }}
        aria-label="Ver movimentos"
        style={{display:'block',width:'calc(100% - 40px)',textAlign:'left',cursor:'pointer',fontFamily:'Inter, sans-serif',margin:'14px 20px 0',...darkCardInk,background:'linear-gradient(135deg, #131022 0%, #0E1A26 100%)',border:'1px solid rgba(0,212,200,0.2)',borderRadius:22,padding:18}}
      >
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(0,212,200,0.85)'}}>💎 Balanço do mês</div>
          <span style={{fontSize:11,fontWeight:700,color:'rgba(0,212,200,0.85)'}}>Movimentos ›</span>
        </div>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:'-1px',color:balance>=0?'#00D4C8':'#E24B4A'}}>{fmt(balance)}</div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:600,marginTop:2}}>entradas − gastos de {format(new Date(),'MMMM',{locale:pt})}</div>
        {hasCarry&&(
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,background:'rgba(0,212,200,0.07)',border:'1px solid rgba(0,212,200,0.2)',borderRadius:11,padding:'9px 12px'}}>
            <span style={{fontSize:14}} aria-hidden>🔁</span>
            <div style={{fontSize:11.5,fontWeight:600,color:'rgba(255,255,255,0.85)',lineHeight:1.4}}>
              Começaste {format(new Date(),'MMMM',{locale:pt})} com <b style={{color:carryInVal>=0?'#00D4C8':'#E24B4A'}}>{fmt(carryInVal)}</b> · disponível <b style={{color:available>=0?'#00D4C8':'#E24B4A'}}>{fmt(available)}</b>
            </div>
          </div>
        )}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <div style={{flex:1,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:12,padding:'9px 10px'}}>
            <div style={{fontSize:9.5,color:'var(--text2)',fontWeight:600}}>Entradas</div>
            <div style={{fontSize:14,fontWeight:800,color:'#00C896',marginTop:2}}>+{fmt(totalIn)}</div>
          </div>
          <div style={{flex:1,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:12,padding:'9px 10px'}}>
            <div style={{fontSize:9.5,color:'var(--text2)',fontWeight:600}}>Gastos</div>
            <div style={{fontSize:14,fontWeight:800,color:'#E24B4A',marginTop:2}}>−{fmt(totalOut)}</div>
            {spendDeltaPct!==null&&Math.abs(spendDeltaPct)>=5&&(
              <div style={{fontSize:9,fontWeight:700,marginTop:3,color:spendDeltaPct>0?'#E24B4A':'#00C896'}}>
                {spendDeltaPct>0?'▲':'▼'} {Math.abs(spendDeltaPct)}% vs. {format(subMonths(new Date(),1),'MMM',{locale:pt})} (ao dia {dayOfMonth})
              </div>
            )}
          </div>
          {savedThisMonth!==0&&(
            <div style={{flex:1,background:'var(--surface-2)',border:`1px solid ${savedThisMonth>0?'rgba(0,200,150,0.18)':'rgba(245,200,66,0.25)'}`,borderRadius:12,padding:'9px 10px'}}>
              <div style={{fontSize:9.5,color:'var(--text2)',fontWeight:600}}>🏦 Poupado</div>
              <div style={{fontSize:14,fontWeight:800,color:savedThisMonth>0?'#00C896':'#F5C842',marginTop:2}}>{fmt(savedThisMonth)}</div>
              <div style={{fontSize:9,fontWeight:600,marginTop:3,color:'rgba(255,255,255,0.4)'}}>{savedThisMonth>0?'movido para a reserva':'levantaste da reserva'}</div>
            </div>
          )}
        </div>
      </button>

      {/* ── Insight do dia: a regra mais relevante de buildInsights ── */}
      {topInsight&&(() => {
        const toneStyle = {
          danger:   { bg:'rgba(226,75,74,0.07)',  border:'rgba(226,75,74,0.28)',  accent:'#E24B4A' },
          warning:  { bg:'rgba(245,200,66,0.07)', border:'rgba(245,200,66,0.30)', accent:'#F5C842' },
          positive: { bg:'rgba(0,200,150,0.06)',  border:'rgba(0,200,150,0.25)',  accent:'#00C896' },
          info:     { bg:'rgba(var(--ink-rgb),0.04)', border:'rgba(var(--ink-rgb),0.12)', accent:'var(--text1)' },
        }[topInsight.tone]
        return (
          <button
            type="button"
            onClick={()=>insights.length>1&&setShowInsights(true)}
            style={{width:'calc(100% - 40px)',textAlign:'left',margin:'12px 20px 0',display:'flex',alignItems:'flex-start',gap:11,background:toneStyle.bg,border:`1px solid ${toneStyle.border}`,borderRadius:16,padding:'12px 14px',fontFamily:'Inter, sans-serif',cursor:insights.length>1?'pointer':'default'}}
          >
            <span style={{fontSize:17,lineHeight:'20px'}} aria-hidden>{topInsight.icon}</span>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.07em',textTransform:'uppercase',color:toneStyle.accent}}>Insight</span>
                {insights.length>1&&<span style={{fontSize:11,fontWeight:700,color:toneStyle.accent}}>Ver todos {insights.length} ›</span>}
              </div>
              <div style={{fontSize:12.5,fontWeight:600,color:'var(--text1)',lineHeight:1.5}}>{topInsight.text}</div>
            </div>
          </button>
        )
      })()}

      <div style={{padding:'0 20px'}} onClick={()=>moreOpen&&setMoreOpen(false)}>
        {/* ── Recorrentes por pagar este mês ── */}
        {pendingRules.length>0&&(
          <>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'20px 0 10px'}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)'}}>A pagar este mês</span>
              <button onClick={()=>setShowRecorrentes(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,color:'#F5C842',fontFamily:'Inter, sans-serif',padding:0}}>Gerir ›</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {pendingRules.map(rule=>(
                <div key={rule.id} style={{display:'flex',alignItems:'center',gap:11,background:'var(--surface-2)',border:'1px solid rgba(245,200,66,0.22)',borderRadius:14,padding:'11px 13px'}}>
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,background:rule.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                    {catEmoji(rule.category)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>
                      {rule.category} <span style={{fontWeight:700,color:rule.type==='entrada'?'#00C896':'#E24B4A'}}>{rule.type==='entrada'?'+':'−'}{fmt(rule.amount)}</span>
                    </div>
                    <div style={{fontSize:10.5,color:'var(--text2)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      todo dia {rule.day_of_month}{rule.description?` · ${rule.description}`:''}
                    </div>
                  </div>
                  <button onClick={()=>skipRecurrence(rule)} aria-label={`Saltar ${rule.category} este mês`} style={{flexShrink:0,border:'1px solid rgba(var(--ink-rgb),0.12)',background:'transparent',color:'var(--text2)',borderRadius:10,padding:'8px 11px',fontSize:11.5,fontWeight:700,fontFamily:'Inter, sans-serif',cursor:'pointer'}}>Saltar</button>
                  <button onClick={()=>postRecurrence(rule)} disabled={postingRuleId===rule.id} aria-label={`Registar ${rule.category}`} style={{flexShrink:0,border:'none',background:'linear-gradient(135deg, #F5C842, #E0A82A)',color:'#1A1200',borderRadius:10,padding:'8px 13px',fontSize:11.5,fontWeight:800,fontFamily:'Inter, sans-serif',cursor:'pointer',opacity:postingRuleId===rule.id?0.6:1}}>{postingRuleId===rule.id?'…':'Registar'}</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Orçamento (resumo) ── */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'20px 0 10px'}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)'}}>Orçamento</span>
          <button onClick={()=>setShowOrcamento(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,color:'#F5C842',fontFamily:'Inter, sans-serif',padding:0}}>Gerir ›</button>
        </div>
        <button onClick={()=>setShowOrcamento(true)} style={{width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:16,padding:'13px 15px'}}>
          {budgetedCats.length>0 ? (
            <>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9}}>
                <span style={{fontSize:15}}>📋</span>
                <span style={{fontSize:13,fontWeight:700,color: 'var(--ink)'}}>{format(new Date(),'MMMM',{locale:pt}).replace(/^./,c=>c.toUpperCase())}</span>
                <span style={{marginLeft:'auto',fontSize:13,fontWeight:800,color:budgetColor}}>{budgetPct}% usado</span>
              </div>
              <div style={{height:7,background:'var(--surface-3)',borderRadius:10,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:10,width:`${Math.min(100,budgetPct)}%`,background:budgetColor}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:'var(--text2)',marginTop:6}}>
                <span>{fmt(totalSpentBudgeted)} de {fmt(totalBudget)}</span>
                <span style={{color:'var(--text1)',fontWeight:700}}>restam {fmt(Math.max(0,totalBudget-totalSpentBudgeted))}</span>
              </div>
              {outsideBudget>0&&(
                <div style={{fontSize:10.5,fontWeight:700,color:'#F5C842',marginTop:6}}>
                  +{fmt(outsideBudget)} gastos em categorias sem orçamento
                </div>
              )}
              {budgetedCats.some(b=>b.spent>b.budget||b.pct>=85)&&(
                <div style={{display:'flex',gap:7,marginTop:10,flexWrap:'wrap'}}>
                  {budgetedCats.filter(b=>b.spent>b.budget).slice(0,2).map(b=>(
                    <span key={b.cat} style={{display:'flex',alignItems:'center',gap:6,fontSize:10.5,fontWeight:700,borderRadius:9,padding:'6px 10px',background:'rgba(226,75,74,0.10)',color:'#E24B4A'}}>{catEmoji(b.cat)} {b.cat} +{fmt(b.spent-b.budget)}</span>
                  ))}
                  {budgetedCats.filter(b=>b.spent<=b.budget&&b.pct>=85).slice(0,2).map(b=>(
                    <span key={b.cat} style={{display:'flex',alignItems:'center',gap:6,fontSize:10.5,fontWeight:700,borderRadius:9,padding:'6px 10px',background:'rgba(245,200,66,0.10)',color:'#F5C842'}}>{catEmoji(b.cat)} {b.cat} {b.pct}%</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>✨</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:'#F5C842'}}>Definir orçamentos</div>
                <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>Sugestões automáticas com base nos teus últimos 3 meses.</div>
              </div>
              <span style={{color:'var(--text3)',fontSize:14}}>›</span>
            </div>
          )}
        </button>

        {/* ── Metas (resumo) ── */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',margin:'20px 0 10px'}}>Metas</div>
        <div style={{display:'flex',gap:9}}>
          {/* Reserva */}
          <button
            onClick={()=>{setGReserve(reserveGoal?String(reserveGoal):'');setGCurrent(currentSavings?String(currentSavings):'');setMetaSheet('reserva')}}
            style={{flex:1,textAlign:'center',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:16,padding:13}}
          >
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(157,92,245,0.85)',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🛡️ Reserva</div>
            {reserveGoal>0 ? (() => {
              const pct = Math.min(100,Math.round(currentSavings/reserveGoal*100))
              const monthsCovered = avgExpenses3m>0 ? currentSavings/avgExpenses3m : null
              return (
                <>
                  <div style={{width:58,height:58,position:'relative',margin:'0 auto 6px'}}>
                    <svg width="58" height="58" viewBox="0 0 58 58" style={{transform:'rotate(-90deg)'}}>
                      <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(157,92,245,0.15)" strokeWidth="6"/>
                      <circle cx="29" cy="29" r="24" fill="none" stroke="#9D5CF5" strokeWidth="6" strokeLinecap="round" strokeDasharray={2*Math.PI*24} strokeDashoffset={2*Math.PI*24*(1-pct/100)}/>
                    </svg>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color: 'var(--ink)'}}>{pct}%</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color: 'var(--ink)'}}>{fmt(currentSavings)}</div>
                  <div style={{fontSize:9.5,color:'var(--text2)',marginTop:2}}>
                    {monthsCovered!==null?`≈ ${monthsCovered.toLocaleString('pt-PT',{maximumFractionDigits:1})} meses cobertos`:`de ${fmt(reserveGoal)}`}
                  </div>
                </>
              )
            })() : (
              <>
                <div style={{fontSize:26,margin:'10px 0 8px'}}>🛡️</div>
                <div style={{display:'inline-block',fontSize:11,fontWeight:800,color:'#1A1200',background:'linear-gradient(135deg, #F5C842, #E0A82A)',borderRadius:9,padding:'7px 14px'}}>Definir</div>
                <div style={{fontSize:9.5,color:'var(--text2)',marginTop:8}}>3–6× despesas mensais</div>
              </>
            )}
          </button>

          {/* Poupança mensal */}
          <button
            onClick={()=>{setGSave(savingsGoal?String(savingsGoal):'');setMetaSheet('poupanca')}}
            style={{flex:1,textAlign:'center',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:16,padding:13}}
          >
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(0,200,150,0.85)',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>💰 Poupança · {format(new Date(),'MMM',{locale:pt})}</div>
            {savingsGoal>0 ? (() => {
              const cur  = savedThisMonth
              const pct  = Math.min(100,Math.max(0,Math.round(cur/savingsGoal*100)))
              const done = cur>=savingsGoal
              return (
                <>
                  <div style={{height:58,display:'flex',flexDirection:'column',justifyContent:'center',gap:7,marginBottom:6}}>
                    <div style={{height:8,background:'var(--surface-3)',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:10,width:`${pct}%`,background:'linear-gradient(90deg,#00C896,#00D4C8)'}}/>
                    </div>
                    <div style={{fontSize:9.5,color:'var(--text2)'}}>{done?'meta atingida 🎉':`faltam ${fmt(savingsGoal-cur)} · ${daysLeft} dias`}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color: 'var(--ink)'}}>{fmt(cur)} <span style={{color:'var(--text3)',fontSize:10}}>/ {fmt(savingsGoal)}</span></div>
                  {done&&<div style={{fontSize:9.5,fontWeight:700,marginTop:2,color:'#00C896'}}>✓ atingida</div>}
                </>
              )
            })() : (
              <>
                <div style={{fontSize:26,margin:'10px 0 8px'}}>💰</div>
                <div style={{display:'inline-block',fontSize:11,fontWeight:800,color:'#1A1200',background:'linear-gradient(135deg, #F5C842, #E0A82A)',borderRadius:9,padding:'7px 14px'}}>Definir</div>
                <div style={{fontSize:9.5,color:'var(--text2)',marginTop:8}}>10–20% do que entra</div>
              </>
            )}
          </button>
        </div>

        {/* ── Visão geral: top categorias do mês + 6 meses ── */}
        {(catBreakdown.total>0||hasHistory)&&(
          <>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',margin:'20px 0 10px'}}>Visão geral</div>

            {catBreakdown.total>0&&(
              <div style={{background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:16,padding:'13px 15px',marginBottom:9}}>
                <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',marginBottom:11}}>
                  Para onde foi o dinheiro · {format(new Date(),'MMMM',{locale:pt})}
                </div>
                {catBreakdown.rows.map(({cat,v})=>{
                  const pct = Math.round(v/catBreakdown.total*100)
                  const other = cat==='Outros'
                  return (
                    <div key={cat} style={{marginBottom:9}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                        <span style={{fontSize:11.5,fontWeight:600,color:'var(--text1)'}}>{other?'📦':catEmoji(cat)} {cat}</span>
                        <span style={{fontSize:11,color:'var(--text2)'}}><b style={{color:'var(--text1)',fontWeight:700}}>{fmt(v)}</b> · {pct}%</span>
                      </div>
                      <div style={{height:8,background:'var(--surface-3)',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:4,width:`${Math.max(2,pct)}%`,background:other?'rgba(var(--ink-rgb),0.25)':CHART_CAT}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {hasHistory&&(
              <div style={{background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:16,padding:'13px 15px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>Entradas vs. saídas · 6 meses</span>
                  <span style={{display:'flex',gap:11,fontSize:10.5,color:'var(--text2)',fontWeight:600}}>
                    <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:8,height:8,borderRadius:4,background:CHART_IN}}/>Entradas</span>
                    <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:8,height:8,borderRadius:4,background:CHART_OUT}}/>Saídas</span>
                  </span>
                </div>
                <div
                  style={{height:140}}
                  role="img"
                  aria-label={`Entradas e saídas dos últimos 6 meses. Mês atual: entradas ${fmt(totalIn)}, saídas ${fmt(totalOut)}.`}
                >
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={monthlyChart} barGap={2}>
                      <CartesianGrid vertical={false} stroke="rgba(var(--ink-rgb),.05)"/>
                      <XAxis dataKey="label" tick={{fill:'rgba(var(--ink-rgb),0.35)',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/>
                      <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)} cursor={{fill:'rgba(var(--ink-rgb),0.04)'}}/>
                      <Bar dataKey="entradas" name="Entradas" fill={CHART_IN} radius={[4,4,0,0]} maxBarSize={14}/>
                      <Bar dataKey="saidas" name="Saídas" fill={CHART_OUT} radius={[4,4,0,0]} maxBarSize={14}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Movimentos recentes ── */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'20px 0 10px'}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)'}}>Movimentos recentes</span>
          <button onClick={()=>setShowMovimentos(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,color:'#F5C842',fontFamily:'Inter, sans-serif',padding:0}}>Ver todos ›</button>
        </div>
        {txs.length===0 ? (
          <div style={{textAlign:'center',padding:'26px 0',color:'var(--text2)',background:'var(--surface-2)',border:'1px dashed rgba(var(--ink-rgb),0.10)',borderRadius:16}}>
            <div style={{fontSize:32,marginBottom:8}}>💸</div>
            <div style={{fontSize:13,marginBottom:4}}>Sem movimentos ainda.</div>
            <div style={{fontSize:11.5}}>Toca em + para registar, ou importa CSV/PDF no menu ⋯</div>
          </div>
        ) : (
          <>
            {txs.slice(0,5).map(t=>(
              <button key={t.id} onClick={()=>openTxSheet(t)} style={{
                display:'flex',alignItems:'center',gap:11,padding:'10px 12px',borderRadius:14,cursor:'pointer',
                background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',
                fontFamily:'Inter, sans-serif',textAlign:'left',width:'100%',marginBottom:6,
              }}>
                <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,background:t.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                  {catEmoji(t.category)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:600,color: 'var(--ink)'}}>{t.category}</div>
                  <div style={{fontSize:10,color:'var(--text2)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{dayLabel(t.date)}{t.description?` · ${t.description}`:''}</div>
                </div>
                <div style={{fontWeight:800,fontSize:13,color:t.type==='entrada'?'#00C896':'#E24B4A',flexShrink:0}}>
                  {t.type==='entrada'?'+':'−'}{fmt(t.amount)}
                </div>
              </button>
            ))}
            {txs.length>5&&(
              <button onClick={()=>setShowMovimentos(true)} style={{width:'100%',textAlign:'center',padding:12,border:'1px solid rgba(var(--ink-rgb),0.10)',borderRadius:14,background:'transparent',fontSize:12.5,fontWeight:700,color:'var(--text1)',fontFamily:'Inter, sans-serif',cursor:'pointer',marginTop:2}}>
                Ver todos os movimentos
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Sheet: movimentos (experiência completa) ── */}
      {showMovimentos&&(
        <Sheet tall icon="💸" title="Movimentos" onClose={()=>setShowMovimentos(false)}
          footer={
            <button onClick={()=>setShowForm(true)} style={{width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,cursor:'pointer',background:'linear-gradient(135deg, #F5C842, #E0A82A)',color:'#1A1200'}}>
              ＋ Registar movimento
            </button>
          }>
        <div style={{paddingTop:10}}>
          {/* Pesquisa */}
          <div style={{display:'flex',alignItems:'center',gap:9,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.10)',borderRadius:13,padding:'0 13px',marginBottom:10}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={txQuery} onChange={e=>setTxQuery(e.target.value)}
              placeholder="Pesquisar movimentos…"
              style={{flex:1,background:'transparent',border:'none',outline:'none',padding:'12px 0',color: 'var(--ink)',fontSize:13,fontFamily:'Inter, sans-serif'}}
            />
            {txQuery && <button onClick={()=>setTxQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text2)',fontSize:13,padding:4}}>✕</button>}
          </div>

          {/* Navegação por mês (ou cabeçalho de resultados na pesquisa) */}
          {searchMode ? (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 2px 4px',marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:'var(--text2)'}}>
                {sheetBusy ? 'A pesquisar…' : `${sheetSourceTxs.length} resultado${sheetSourceTxs.length!==1?'s':''} em todo o histórico`}
              </span>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <button
                onClick={()=>setMonthCursor(d=>startOfMonth(subMonths(d,1)))}
                aria-label="Mês anterior"
                style={{width:34,height:34,borderRadius:11,flexShrink:0,border:'1px solid rgba(var(--ink-rgb),0.10)',background:'var(--surface-2)',color:'var(--text1)',cursor:'pointer',fontSize:15,fontWeight:700}}
              >‹</button>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:800,color:'var(--ink)',letterSpacing:'-0.2px'}}>
                  {format(monthCursor,'MMMM yyyy',{locale:pt}).replace(/^./,c=>c.toUpperCase())}
                </div>
                <div style={{fontSize:10.5,color:'var(--text2)',marginTop:1}}>
                  {sheetBusy ? 'a carregar…' : (() => {
                    const net = sheetSourceTxs.reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0)
                    return <>saldo <b style={{color:net>=0?'#00C896':'#E24B4A'}}>{net>=0?'+':'−'}{fmt(Math.abs(net))}</b> · {sheetSourceTxs.length} mov.</>
                  })()}
                </div>
              </div>
              <button
                onClick={()=>setMonthCursor(d=>startOfMonth(addMonths(d,1)))}
                disabled={isCurrentMonthCursor}
                aria-label="Mês seguinte"
                style={{width:34,height:34,borderRadius:11,flexShrink:0,border:'1px solid rgba(var(--ink-rgb),0.10)',background:'var(--surface-2)',color:'var(--text1)',cursor:isCurrentMonthCursor?'not-allowed':'pointer',opacity:isCurrentMonthCursor?0.35:1,fontSize:15,fontWeight:700}}
              >›</button>
            </div>
          )}

          {/* Filtros */}
          <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4,marginBottom:4,scrollbarWidth:'none'}}>
            {([['all','Todas'],['entrada','↓ Entradas'],['saida','↑ Saídas']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTxFilter(k)} style={{
                flexShrink:0,fontSize:12,fontWeight:600,padding:'7px 13px',borderRadius:20,cursor:'pointer',
                border:`1px solid ${txFilter===k?'rgba(245,200,66,0.3)':'rgba(var(--ink-rgb),0.1)'}`,
                color:txFilter===k?'#F5C842':'rgba(var(--ink-rgb),0.5)',
                background:txFilter===k?'rgba(245,200,66,0.12)':'transparent',
                fontFamily:'Inter, sans-serif',whiteSpace:'nowrap',
              }}>{l}</button>
            ))}
            {txCatOptions.map(c=>(
              <button key={c} onClick={()=>setTxCat(txCat===c?null:c)} style={{
                flexShrink:0,fontSize:12,fontWeight:600,padding:'7px 13px',borderRadius:20,cursor:'pointer',
                border:`1px solid ${txCat===c?'rgba(245,200,66,0.3)':'rgba(var(--ink-rgb),0.1)'}`,
                color:txCat===c?'#F5C842':'rgba(var(--ink-rgb),0.5)',
                background:txCat===c?'rgba(245,200,66,0.12)':'transparent',
                fontFamily:'Inter, sans-serif',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5,
              }}>{catEmoji(c)} {c}{txCat===c?' ✕':''}</button>
            ))}
          </div>

          {/* Agregado do filtro */}
          {filterActive && filteredTxs.length>0 && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(245,200,66,0.06)',border:'1px solid rgba(245,200,66,0.2)',borderRadius:13,padding:'11px 14px',margin:'10px 0 2px'}}>
              <span style={{fontSize:12,color:'var(--text1)'}}>
                <b style={{color: 'var(--ink)'}}>{filteredTxs.length} movimento{filteredTxs.length!==1?'s':''}</b>
                {txCat?` · ${txCat}`:''}
              </span>
              <span style={{fontSize:14,fontWeight:800,color:filteredTotal>=0?'#00C896':'#E24B4A'}}>
                {filteredTotal>=0?'+':'−'}{fmt(Math.abs(filteredTotal))}
              </span>
            </div>
          )}

          {/* Vazio (só quando não está a carregar) */}
          {filteredTxs.length===0&&!sheetBusy&&(
            <div style={{textAlign:'center',padding:'40px 0',color:'var(--text2)'}}>
              <div style={{fontSize:40,marginBottom:12}}>{searchMode?'🔍':'💸'}</div>
              <div style={{fontSize:14,marginBottom:6}}>
                {searchMode
                  ? `Nada encontrado para “${txQuery.trim()}”.`
                  : (txFilter!=='all'||txCat)
                    ? 'Nada com este filtro neste mês.'
                    : `Sem movimentos em ${format(monthCursor,'MMMM',{locale:pt})}.`}
              </div>
              {!filterActive&&isCurrentMonthCursor&&<div style={{fontSize:12}}>Clica em + Registar ou importa um CSV.</div>}
            </div>
          )}

          {/* Grupos por dia */}
          {txGroups.map(([date,list])=>{
            const dayNet = list.reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0)
            return (
              <div key={date}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'14px 2px 8px'}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)'}}>{dayLabel(date)}</span>
                  <span style={{fontSize:11,fontWeight:700,color:dayNet>=0?'#00C896':'#E24B4A'}}>
                    {dayNet>=0?'+':'−'}{fmt(Math.abs(dayNet))}
                  </span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {list.map(t=>(
                    <button key={t.id} onClick={()=>openTxSheet(t)} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'11px 13px',borderRadius:14,cursor:'pointer',
                      background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',
                      fontFamily:'Inter, sans-serif',textAlign:'left',width:'100%',
                    }}>
                      <div style={{width:38,height:38,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,background:t.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                        {catEmoji(t.category)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:600,color: 'var(--ink)'}}>{t.category}</div>
                        {t.description&&<div style={{fontSize:10.5,color:'var(--text2)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.description}</div>}
                      </div>
                      <div style={{fontWeight:800,fontSize:14,color:t.type==='entrada'?'#00C896':'#E24B4A',flexShrink:0}}>
                        {t.type==='entrada'?'+':'−'}{fmt(t.amount)}
                      </div>
                      <span style={{color:'var(--text3)',fontSize:14,flexShrink:0}}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {txGroups.length>0&&(
            <div style={{margin:'16px 0',padding:'12px 14px',borderRadius:12,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
              <strong style={{color:'var(--text1)'}}>Formato CSV:</strong> cabeçalho{' '}
              <code style={{background:'var(--surface-3)',padding:'1px 5px',borderRadius:4}}>data,tipo,categoria,valor,descricao</code>
              . Tipo: &quot;entrada&quot; ou &quot;saida&quot;.
            </div>
          )}
        </div>
        </Sheet>
      )}

      {/* ── Sheet: orçamento (experiência completa) ── */}
      {showOrcamento&&(
        <Sheet tall icon="📋" title={`Orçamento de ${format(new Date(),'MMMM',{locale:pt})}`} onClose={()=>setShowOrcamento(false)}>
        <div style={{paddingTop:10}}>
          {budgetedCats.length>0 ? (
            <>
              {/* Gauge global do mês */}
              <div style={{
                ...darkCardInk,
                background:'linear-gradient(135deg, #0E1A14 0%, #0D1F1A 60%, #0E1626 100%)',
                border:'1px solid rgba(0,200,150,0.22)',borderRadius:22,padding:18,
                display:'flex',gap:16,alignItems:'center',marginBottom:14,
              }}>
                <div style={{width:92,height:92,position:'relative',flexShrink:0}}>
                  <svg width="92" height="92" viewBox="0 0 92 92" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="46" cy="46" r="38" fill="none" stroke="rgba(0,200,150,0.15)" strokeWidth="8"/>
                    <circle cx="46" cy="46" r="38" fill="none" stroke={budgetColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={2*Math.PI*38} strokeDashoffset={2*Math.PI*38*(1-budgetPct/100)}/>
                  </svg>
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                    <div style={{fontSize:18,fontWeight:800,color: 'var(--ink)'}}>{budgetPct}%</div>
                    <div style={{fontSize:8.5,color:'var(--text2)',fontWeight:600}}>USADO</div>
                  </div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(0,200,150,0.85)',display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    📋 Orçamento de {format(new Date(),'MMMM',{locale:pt})}
                  </div>
                  <div style={{fontSize:21,fontWeight:900,letterSpacing:'-0.5px',color: 'var(--ink)'}}>
                    {fmt(totalSpentBudgeted)} <span style={{fontSize:13,fontWeight:600,color:'var(--text2)'}}>de {fmt(totalBudget)}</span>
                  </div>
                  <div style={{fontSize:11.5,color:'var(--text2)',marginTop:5,lineHeight:1.45}}>
                    Restam <b style={{color: 'var(--ink)'}}>{fmt(Math.max(0,totalBudget-totalSpentBudgeted))}</b> para {daysLeft} dias.
                  </div>
                </div>
              </div>

              {/* Categorias por uso */}
              {budgetedCats.map(({cat,budget,spent,pct})=>{
                const over = spent>budget
                const warn = !over && pct>=85
                return (
                  <button key={cat} onClick={()=>{setBudgetSheet(cat);setBudgetVal(String(budget))}} style={{
                    width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'Inter, sans-serif',
                    background:over?'rgba(226,75,74,0.04)':'rgba(var(--ink-rgb),0.04)',
                    border:`1px solid ${over?'rgba(226,75,74,0.3)':'rgba(var(--ink-rgb),0.07)'}`,
                    borderRadius:15,padding:'12px 14px',marginBottom:8,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:9}}>
                      <div style={{width:32,height:32,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,background:over?'rgba(226,75,74,0.12)':warn?'rgba(245,200,66,0.12)':'rgba(var(--ink-rgb),0.06)'}}>
                        {catEmoji(cat)}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color: 'var(--ink)'}}>{cat}</div>
                      {over&&<span style={{fontSize:9.5,fontWeight:800,borderRadius:7,padding:'3px 7px',background:'rgba(226,75,74,0.12)',color:'#E24B4A',flexShrink:0}}>+{fmt(spent-budget)} acima</span>}
                      {warn&&<span style={{fontSize:9.5,fontWeight:800,borderRadius:7,padding:'3px 7px',background:'rgba(245,200,66,0.12)',color:'#F5C842',flexShrink:0}}>atenção</span>}
                      <div style={{marginLeft:'auto',fontSize:12.5,fontWeight:700,color:'var(--text1)',flexShrink:0}}>
                        {fmt(spent)} <span style={{color:'var(--text3)',fontWeight:600}}>/ {fmt(budget)}</span>
                      </div>
                      <span style={{color:'var(--text3)',fontSize:14}}>›</span>
                    </div>
                    <div style={{height:6,background:'var(--surface-3)',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:10,width:`${Math.min(100,pct)}%`,background:over?'#E24B4A':warn?'#F5C842':'#00C896',transition:'width .4s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text3)',marginTop:5}}>
                      <span>{pct}% usado</span>
                      <span>{over?`excedeu o orçamento`:`${fmt(budget-spent)} restantes`}</span>
                    </div>
                  </button>
                )
              })}

              {/* Sem orçamento */}
              {unbudgetedCats.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',margin:'18px 0 10px'}}>Sem orçamento</div>
                  {unbudgetedCats.map(cat=>(
                    <button key={cat} onClick={()=>{setBudgetSheet(cat);setBudgetVal('')}} style={{
                      width:'100%',display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontFamily:'Inter, sans-serif',
                      background:'var(--surface-2)',border:'1px dashed rgba(var(--ink-rgb),0.12)',
                      borderRadius:13,padding:'10px 13px',marginBottom:7,
                    }}>
                      <span style={{fontSize:15}}>{catEmoji(cat)}</span>
                      <span style={{fontSize:12.5,fontWeight:600,color:'var(--text2)'}}>
                        {cat}{(spentByCat[cat]??0)>0?` · ${fmt(spentByCat[cat])} este mês`:''}
                      </span>
                      <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:'#F5C842'}}>Definir</span>
                    </button>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              {/* Estado vazio: sugestão automática */}
              <div style={{
                display:'flex',alignItems:'center',gap:12,marginBottom:14,
                background:'rgba(245,200,66,0.05)',border:'1px dashed rgba(245,200,66,0.35)',
                borderRadius:16,padding:'13px 15px',
              }}>
                <span style={{fontSize:24}}>✨</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#F5C842'}}>Sugerir orçamentos automaticamente</div>
                  <div style={{fontSize:11,color:'var(--text2)',marginTop:2,lineHeight:1.45}}>Com base na média dos teus últimos 3 meses de movimentos, por categoria.</div>
                </div>
              </div>

              {budgetSuggestions.length>0 ? (
                <>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',margin:'4px 0 10px'}}>Sugestões prontas a aplicar</div>
                  {budgetSuggestions.map(({cat,avg,suggested})=>(
                    <div key={cat} style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:15,padding:'12px 14px',marginBottom:8}}>
                      <span style={{fontSize:16}}>{catEmoji(cat)}</span>
                      <span style={{fontSize:13,fontWeight:700,color: 'var(--ink)'}}>{cat}</span>
                      <span style={{marginLeft:'auto',fontSize:11.5,color:'var(--text3)',fontWeight:600}}>média {fmt(avg)} →</span>
                      <span style={{fontSize:13,fontWeight:800,color: 'var(--ink)'}}>{fmt(suggested)}</span>
                      <button onClick={()=>saveBudget(cat,String(suggested))} style={{fontSize:10,fontWeight:800,borderRadius:8,padding:'5px 10px',background:'rgba(0,200,150,0.12)',color:'#00C896',border:'none',cursor:'pointer'}}>Aplicar</button>
                    </div>
                  ))}
                  <button
                    onClick={()=>{
                      const updated={...budgets}
                      budgetSuggestions.forEach(s=>{updated[s.cat]=s.suggested})
                      persistBudgets(updated)
                      showToast('Orçamentos aplicados!')
                    }}
                    style={{width:'100%',marginTop:8,border:'none',borderRadius:15,padding:15,cursor:'pointer',background:'linear-gradient(135deg, #F5C842, #E0A82A)',color:'#1A1200',fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15}}
                  >
                    Aplicar todos ({budgetSuggestions.length})
                  </button>
                  <div style={{textAlign:'center',fontSize:11.5,color:'var(--text3)',marginTop:10}}>ou define manualmente categoria a categoria</div>
                </>
              ) : (
                <div style={{textAlign:'center',padding:'30px 0',color:'var(--text2)',fontSize:13,lineHeight:1.6}}>
                  Regista alguns movimentos primeiro — as sugestões aparecem com base no teu histórico.
                </div>
              )}

              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',margin:'18px 0 10px'}}>Todas as categorias</div>
              {BUDGET_CATS.map(cat=>(
                <button key={cat} onClick={()=>{setBudgetSheet(cat);setBudgetVal('')}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontFamily:'Inter, sans-serif',
                  background:'var(--surface-2)',border:'1px dashed rgba(var(--ink-rgb),0.12)',
                  borderRadius:13,padding:'10px 13px',marginBottom:7,
                }}>
                  <span style={{fontSize:15}}>{catEmoji(cat)}</span>
                  <span style={{fontSize:12.5,fontWeight:600,color:'var(--text2)'}}>{cat}</span>
                  <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:'#F5C842'}}>Definir</span>
                </button>
              ))}
            </>
          )}
        </div>
        </Sheet>
      )}

      {/* ── Sheet: nova transação ── */}
      {showForm&&(() => {
        const canSaveNew = !!fAmount && (fCat===CUSTOM_KEY ? !!fCustomCat.trim() : !!fCat)
        return (
        <Sheet icon="💸" title="Nova transação" onClose={()=>setShowForm(false)}
          footer={
            <button onClick={addTx} disabled={saving||!canSaveNew} style={{
              width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,
              cursor:canSaveNew?'pointer':'not-allowed',
              background:canSaveNew?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(var(--ink-rgb),0.06)',
              color:canSaveNew?'#1A1200':'rgba(var(--ink-rgb),0.35)',
            }}>{saving?'A guardar…':'Guardar movimento'}</button>
          }>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            {(['entrada','saida'] as const).map(t=>(
              <button key={t} onClick={()=>{setTxType(t);setFCat('');setFCustomCat('')}} style={{
                flex:1,padding:'11px',borderRadius:13,cursor:'pointer',
                fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,
                background: txType===t ? (t==='entrada'?'rgba(0,200,150,0.12)':'rgba(226,75,74,0.12)') : 'rgba(var(--ink-rgb),0.03)',
                border: `1px solid ${txType===t ? (t==='entrada'?'rgba(0,200,150,0.5)':'rgba(226,75,74,0.5)') : 'rgba(var(--ink-rgb),0.10)'}`,
                color: txType===t ? (t==='entrada'?'#00C896':'#E24B4A') : 'rgba(var(--ink-rgb),0.55)',
              }}>
                {t==='entrada'?'↓ Entrada':'↑ Saída'}
              </button>
            ))}
          </div>

          <label style={sheetLabel}>Valor (€)</label>
          <input type="number" step="0.01" value={fAmount} onChange={e=>setFAmount(e.target.value)} placeholder="0.00" style={{...sheetInp,fontSize:18,fontWeight:700}}/>

          <label style={sheetLabel}>Categoria</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {(txType==='entrada'?CATEGORIES_IN:OUT_CATS).map(cat=>(
              <button key={cat} onClick={()=>setFCat(cat)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:11,cursor:'pointer',
                fontSize:12,fontWeight:600,fontFamily:'Inter, sans-serif',
                background:fCat===cat?'rgba(245,200,66,0.10)':'rgba(var(--ink-rgb),0.03)',
                border:`1px solid ${fCat===cat?'rgba(245,200,66,0.45)':'rgba(var(--ink-rgb),0.10)'}`,
                color:fCat===cat?'#F5C842':'rgba(var(--ink-rgb),0.55)',
              }}>{catEmoji(cat)} {cat}</button>
            ))}
            <button onClick={()=>setFCat(CUSTOM_KEY)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:11,cursor:'pointer',
              fontSize:12,fontWeight:600,fontFamily:'Inter, sans-serif',
              background:fCat===CUSTOM_KEY?'rgba(127,119,221,0.18)':'rgba(var(--ink-rgb),0.03)',
              border:`1px solid ${fCat===CUSTOM_KEY?'rgba(127,119,221,0.55)':'rgba(var(--ink-rgb),0.10)'}`,
              color:fCat===CUSTOM_KEY?'#9D8DF5':'rgba(var(--ink-rgb),0.55)',
            }}>✏️ Personalizar</button>
          </div>
          {fCat===CUSTOM_KEY && (
            <input
              value={fCustomCat}
              onChange={e=>setFCustomCat(e.target.value)}
              placeholder="Ex: Água, Luz, Veterinário…"
              style={{...sheetInp,marginTop:10}}
              autoFocus
            />
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={sheetLabel}>Descrição</label>
              <input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Opcional" style={sheetInp}/>
            </div>
            <div>
              <label style={sheetLabel}>Data</label>
              <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={sheetInp}/>
            </div>
          </div>

          {/* Sugestão de categoria pela descrição (mesma heurística do import) */}
          {(() => {
            if (fCat || fDesc.trim().length < 3) return null
            const s = suggestCategory(fDesc, txType)
            if (s === 'Outro') return null
            return (
              <button onClick={()=>setFCat(s)} style={{
                display:'flex',alignItems:'center',gap:7,marginTop:12,padding:'9px 13px',
                borderRadius:11,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter, sans-serif',
                background:'rgba(0,200,150,0.08)',border:'1px solid rgba(0,200,150,0.3)',color:'#00C896',
              }}>
                💡 Sugestão: {catEmoji(s)} {s}
              </button>
            )
          })()}

          {/* Repetir todos os meses → cria uma regra recorrente */}
          <button
            onClick={()=>setFRepeat(v=>!v)}
            role="switch"
            aria-checked={fRepeat}
            style={{
              display:'flex',alignItems:'center',gap:11,width:'100%',marginTop:16,padding:'12px 14px',
              borderRadius:13,cursor:'pointer',fontFamily:'Inter, sans-serif',textAlign:'left',
              background:fRepeat?'rgba(245,200,66,0.08)':'var(--surface-2)',
              border:`1px solid ${fRepeat?'rgba(245,200,66,0.4)':'rgba(var(--ink-rgb),0.10)'}`,
            }}
          >
            <span style={{fontSize:17}}>🔁</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>Repetir todos os meses</div>
              <div style={{fontSize:11,color:'var(--text2)',marginTop:1}}>Aparece em &quot;a pagar&quot; no dia {Math.min(28,Math.max(1,Number(fDate.slice(8,10))||1))} de cada mês.</div>
            </div>
            <span style={{flexShrink:0,width:40,height:23,borderRadius:12,background:fRepeat?'#F5C842':'var(--surface-3)',position:'relative',transition:'background .2s'}}>
              <span style={{position:'absolute',top:2,left:fRepeat?19:2,width:19,height:19,borderRadius:10,background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
            </span>
          </button>
        </Sheet>
        )
      })()}

      {/* ── Sheet: detalhe/edição de movimento ── */}
      {openTx && !confirmDeleteTx && (
        <Sheet icon={catEmoji(etCat||openTx.category)} title="Movimento" onClose={()=>setOpenTx(null)}
          footer={
            <button onClick={saveTxEdit} disabled={txEditSaving||!etAmount||!etCat} style={{
              width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,
              cursor:(etAmount&&etCat)?'pointer':'not-allowed',
              background:(etAmount&&etCat)?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(var(--ink-rgb),0.06)',
              color:(etAmount&&etCat)?'#1A1200':'rgba(var(--ink-rgb),0.35)',
            }}>{txEditSaving?'A guardar…':'Guardar alterações'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color:etType==='entrada'?'#00C896':'#E24B4A'}}>{etType==='entrada'?'+':'−'}€</span>
              <input
                type="number" step="0.01" value={etAmount} onChange={e=>setEtAmount(e.target.value)}
                aria-label="Valor"
                style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color:etType==='entrada'?'#00C896':'#E24B4A',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:2}}>{dayLabel(openTx.date)}</div>
          </div>

          {/* Trocar o tipo mantém a categoria se existir na lista do novo tipo
              (ex.: Poupança), senão obriga a escolher de novo. */}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            {(['entrada','saida'] as const).map(t=>(
              <button key={t} onClick={()=>{
                if (t===etType) return
                setEtType(t)
                setEtCat(prev=>(t==='entrada'?CATEGORIES_IN:OUT_CATS).includes(prev)?prev:'')
              }} style={{
                flex:1,padding:'11px',borderRadius:13,cursor:'pointer',
                fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,
                background: etType===t ? (t==='entrada'?'rgba(0,200,150,0.12)':'rgba(226,75,74,0.12)') : 'rgba(var(--ink-rgb),0.03)',
                border: `1px solid ${etType===t ? (t==='entrada'?'rgba(0,200,150,0.5)':'rgba(226,75,74,0.5)') : 'rgba(var(--ink-rgb),0.10)'}`,
                color: etType===t ? (t==='entrada'?'#00C896':'#E24B4A') : 'rgba(var(--ink-rgb),0.55)',
              }}>
                {t==='entrada'?'↓ Entrada':'↑ Saída'}
              </button>
            ))}
          </div>

          <label style={sheetLabel}>Categoria</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {(etType==='entrada'?CATEGORIES_IN:OUT_CATS).map(cat=>(
              <button key={cat} onClick={()=>setEtCat(cat)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:11,cursor:'pointer',
                fontSize:12,fontWeight:600,fontFamily:'Inter, sans-serif',
                background:etCat===cat?'rgba(245,200,66,0.10)':'rgba(var(--ink-rgb),0.03)',
                border:`1px solid ${etCat===cat?'rgba(245,200,66,0.45)':'rgba(var(--ink-rgb),0.10)'}`,
                color:etCat===cat?'#F5C842':'rgba(var(--ink-rgb),0.55)',
              }}>{catEmoji(cat)} {cat}</button>
            ))}
          </div>

          <label style={sheetLabel}>Descrição</label>
          <input value={etDesc} onChange={e=>setEtDesc(e.target.value)} placeholder="Opcional" style={sheetInp}/>

          <label style={sheetLabel}>Data</label>
          <input type="date" value={etDate} onChange={e=>setEtDate(e.target.value)} style={sheetInp}/>

          <button onClick={()=>setConfirmDeleteTx(openTx)} style={{
            marginTop:18,width:'100%',display:'flex',alignItems:'center',gap:10,
            border:'1px solid rgba(226,75,74,0.25)',borderRadius:13,padding:'13px 14px',
            background:'transparent',color:'#E24B4A',fontSize:13.5,fontWeight:700,
            fontFamily:'Inter, sans-serif',cursor:'pointer',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Apagar movimento
            <span style={{marginLeft:'auto',fontSize:11,fontWeight:500,color:'rgba(226,75,74,0.6)'}}>pede confirmação</span>
          </button>
        </Sheet>
      )}

      {/* ── Confirmação de apagar movimento ── */}
      {confirmDeleteTx && (
        <div
          style={{position:'fixed',inset:0,zIndex:10001,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.7)',padding:24}}
          onClick={e=>e.target===e.currentTarget&&setConfirmDeleteTx(null)}
        >
          <div style={{width:'100%',maxWidth:340,background:'var(--surface-pop)',border:'1px solid rgba(var(--ink-rgb),0.12)',borderRadius:20,padding:'22px 20px',fontFamily:'Inter, sans-serif'}}>
            <div style={{fontSize:16,fontWeight:800,color: 'var(--ink)',marginBottom:8}}>Apagar movimento?</div>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5,marginBottom:18,overflowWrap:'anywhere'}}>
              {confirmDeleteTx.category}{confirmDeleteTx.description?` · ${confirmDeleteTx.description}`:''} ({confirmDeleteTx.type==='entrada'?'+':'−'}{fmt(confirmDeleteTx.amount)}) vai ser removido. Esta ação é irreversível.
            </p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setConfirmDeleteTx(null)} style={{flex:1,padding:'12px 0',borderRadius:13,border:'1px solid rgba(var(--ink-rgb),0.12)',background:'var(--surface-2)',color:'var(--text1)',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>Cancelar</button>
              <button onClick={removeTxConfirmed} style={{flex:1,padding:'12px 0',borderRadius:13,border:'none',background:'#E24B4A',color: 'var(--on-accent)',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>Apagar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: orçamento por categoria ── */}
      {budgetSheet && (() => {
        const avg   = catAvg3m[budgetSheet] ?? 0
        const spark = catMonthly[budgetSheet] ?? []
        const maxSp = Math.max(1,...spark)
        const n     = parseFloat(budgetVal.replace(',','.'))
        const folga = Number.isFinite(n)&&avg>0 ? n-avg : null
        return (
          <Sheet icon={catEmoji(budgetSheet)} title={`Orçamento · ${budgetSheet}`} onClose={()=>setBudgetSheet(null)}
            footer={
              <button
                onClick={()=>{saveBudget(budgetSheet,budgetVal||'0');setBudgetSheet(null)}}
                disabled={!budgetVal||!Number.isFinite(n)||n<0}
                style={{
                  width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,
                  cursor:budgetVal?'pointer':'not-allowed',
                  background:budgetVal?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(var(--ink-rgb),0.06)',
                  color:budgetVal?'#1A1200':'rgba(var(--ink-rgb),0.35)',
                }}>Guardar orçamento</button>
            }>
            <div style={{textAlign:'center',margin:'10px 0 2px'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:30,fontWeight:900,color: 'var(--ink)'}}>€</span>
                <input
                  type="number" step="1" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)}
                  placeholder="0" aria-label="Valor do orçamento"
                  style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color: 'var(--ink)',fontFamily:'Inter, sans-serif'}}
                />
              </div>
              <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:2}}>por mês</div>
            </div>
            <StepChips steps={[-50,-10,10,50]} onStep={d=>stepValue(budgetVal,d,setBudgetVal)}/>

            {avg>0&&(
              <>
                <div style={{marginTop:16,background:'rgba(0,200,150,0.06)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'var(--text1)'}}>
                  💡 Gastaste em média <b style={{color:'#00C896'}}>{fmt(avg)}/mês</b> em {budgetSheet} nos últimos 3 meses.
                  {folga!==null&&(folga>=0
                    ? <> O orçamento atual dá uma folga de <b style={{color:'#00C896'}}>{fmt(folga)}</b>.</>
                    : <> O orçamento atual fica <b style={{color:'#E24B4A'}}>{fmt(-folga)} abaixo</b> da tua média.</>)}
                  {' '}<button onClick={()=>setBudgetVal(String(Math.ceil((avg*1.05)/10)*10))} style={{background:'none',border:'none',cursor:'pointer',color:'#F5C842',fontWeight:700,fontSize:12,padding:0,fontFamily:'Inter, sans-serif'}}>Usar média</button>
                </div>
                {spark.length===4&&(
                  <>
                    <div style={{display:'flex',alignItems:'flex-end',gap:5,height:42,marginTop:12}}>
                      {spark.map((v,i)=>(
                        <div key={i} style={{flex:1,borderRadius:'3px 3px 0 0',height:`${Math.max(8,Math.round(v/maxSp*100))}%`,background:i===3?'#F5C842':'rgba(0,200,150,0.5)'}}/>
                      ))}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'var(--text3)',marginTop:4,padding:'0 2px'}}>
                      {[3,2,1,0].map(i=>{
                        const lbl=format(subMonths(new Date(),i),'MMM',{locale:pt})
                        return <span key={i} style={i===0?{color:'#F5C842',fontWeight:700}:undefined}>{lbl}</span>
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {(budgets[budgetSheet]??0)>0&&(
              <button onClick={()=>{saveBudget(budgetSheet,'0');setBudgetSheet(null)}} style={{
                marginTop:16,width:'100%',display:'flex',alignItems:'center',gap:10,
                border:'1px solid rgba(var(--ink-rgb),0.10)',borderRadius:13,padding:'12px 14px',
                background:'transparent',fontSize:12.5,fontWeight:600,color:'var(--text2)',
                fontFamily:'Inter, sans-serif',cursor:'pointer',
              }}>
                Remover orçamento desta categoria
                <span style={{marginLeft:'auto',fontSize:11,fontWeight:700,color:'rgba(226,75,74,0.8)'}}>Remover</span>
              </button>
            )}
          </Sheet>
        )
      })()}

      {/* ── Sheet: metas (reserva / poupança mensal) ── */}
      {metaSheet==='reserva' && (
        <Sheet icon="🛡️" title="Reserva de emergência" onClose={()=>setMetaSheet(null)}
          footer={
            <button onClick={saveMeta} disabled={gSaving||!gReserve} style={{
              width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,
              cursor:gReserve?'pointer':'not-allowed',
              background:gReserve?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(var(--ink-rgb),0.06)',
              color:gReserve?'#1A1200':'rgba(var(--ink-rgb),0.35)',
            }}>{gSaving?'A guardar…':'Guardar meta'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color: 'var(--ink)'}}>€</span>
              <input
                type="number" step="50" value={gReserve} onChange={e=>setGReserve(e.target.value)}
                placeholder="5000" aria-label="Objetivo da reserva"
                style={{width:150,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color: 'var(--ink)',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:2}}>objetivo da reserva</div>
          </div>
          <StepChips steps={[-500,-100,100,500]} onStep={d=>stepValue(gReserve,d,setGReserve)}/>

          <label style={sheetLabel}>Poupança atual acumulada</label>
          <input type="number" step="0.01" value={gCurrent} onChange={e=>setGCurrent(e.target.value)} placeholder="Ex: 1200" style={sheetInp}/>

          {avgExpenses3m>0&&(
            <div style={{marginTop:16,background:'rgba(157,92,245,0.07)',border:'1px solid rgba(157,92,245,0.2)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'var(--text1)'}}>
              💡 As tuas despesas médias são <b style={{color:'#9D5CF5'}}>{fmt(avgExpenses3m)}/mês</b>. Uma reserva de 3–6 meses fica entre <b style={{color:'#9D5CF5'}}>{fmt(avgExpenses3m*3)} e {fmt(avgExpenses3m*6)}</b>.
            </div>
          )}
        </Sheet>
      )}

      {metaSheet==='poupanca' && (
        <Sheet icon="💰" title="Poupança mensal" onClose={()=>setMetaSheet(null)}
          footer={
            <button onClick={saveMeta} disabled={gSaving||!gSave} style={{
              width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,
              cursor:gSave?'pointer':'not-allowed',
              background:gSave?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(var(--ink-rgb),0.06)',
              color:gSave?'#1A1200':'rgba(var(--ink-rgb),0.35)',
            }}>{gSaving?'A guardar…':'Guardar meta'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color: 'var(--ink)'}}>€</span>
              <input
                type="number" step="10" value={gSave} onChange={e=>setGSave(e.target.value)}
                placeholder="300" aria-label="Meta de poupança mensal"
                style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color: 'var(--ink)',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:2}}>por mês</div>
          </div>
          <StepChips steps={[-50,-10,10,50]} onStep={d=>stepValue(gSave,d,setGSave)}/>

          {avgIncome3m>0&&(
            <div style={{marginTop:16,background:'rgba(0,200,150,0.06)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'var(--text1)'}}>
              💡 Entram em média <b style={{color:'#00C896'}}>{fmt(avgIncome3m)}/mês</b>. Poupar 10–20% fica entre <b style={{color:'#00C896'}}>{fmt(avgIncome3m*0.1)} e {fmt(avgIncome3m*0.2)}</b>.
            </div>
          )}

          {/* Histórico de poupança + projeção (migrado da antiga tab Metas).
              Usa o `poupado` (líquido movido para a reserva), a mesma medida
              da meta acima — não o que sobrou do mês. */}
          <label style={sheetLabel}>Histórico de poupança</label>
          <div
            style={{height:110,overflow:'hidden'}}
            role="img"
            aria-label={`Gráfico de poupança dos últimos 6 meses. Poupança do mês atual: ${fmt(savedThisMonth)}.`}
          >
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={monthlyChart}>
                <CartesianGrid vertical={false} stroke="rgba(var(--ink-rgb),.04)"/>
                <XAxis dataKey="label" tick={{fill:'rgba(var(--ink-rgb),0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                {savingsGoal>0&&<ReferenceLine y={savingsGoal} stroke="rgba(245,200,66,0.55)" strokeDasharray="5 4"/>}
                <Bar dataKey="poupado" name="Poupado" radius={[5,5,0,0]}>
                  {monthlyChart.map((m,i)=><Cell key={i} fill={m.poupado>=0?'#00C896':'#E24B4A'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            if (savingsGoal<=0) return null
            const above = monthlyChart.filter(m=>m.poupado>=savingsGoal).length
            const avgSave = monthlyChart.slice(0,5).reduce((a,m)=>a+m.poupado,0)/Math.max(1,monthlyChart.slice(0,5).length)
            const remaining = reserveGoal-currentSavings
            const projection = reserveGoal>0&&remaining>0&&avgSave>0
              ? format(addMonths(new Date(),Math.ceil(remaining/avgSave)),'MMM yyyy',{locale:pt})
              : null
            return (
              <div style={{marginTop:10,background:'rgba(0,200,150,0.05)',border:'1px solid rgba(0,200,150,0.15)',borderRadius:13,padding:'11px 13px',fontSize:12,lineHeight:1.55,color:'var(--text1)'}}>
                <b style={{color:'#00C896'}}>Mentor:</b> {above} dos últimos 6 meses acima da meta.
                {projection&&<> Mantendo esta média, a reserva fica completa em <b style={{color:'#00C896'}}>{projection}</b>.</>}
              </div>
            )
          })()}
        </Sheet>
      )}

      {/* ── Sheet: gestão de recorrentes ── */}
      {showRecorrentes&&(
        <Sheet tall icon="🔁" title="Recorrentes" onClose={()=>setShowRecorrentes(false)}>
          <div style={{paddingTop:10}}>
            {recurring.length>0 ? (
              <>
                {/* Resumo mensal */}
                <div style={{display:'flex',gap:9,marginBottom:14}}>
                  <div style={{flex:1,background:'rgba(0,200,150,0.06)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:14,padding:'11px 13px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'rgba(0,200,150,0.9)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Entra / mês</div>
                    <div style={{fontSize:16,fontWeight:800,color:'var(--ink)',marginTop:3}}>+{fmt(recurringInTotal)}</div>
                  </div>
                  <div style={{flex:1,background:'rgba(226,75,74,0.06)',border:'1px solid rgba(226,75,74,0.18)',borderRadius:14,padding:'11px 13px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'rgba(226,75,74,0.9)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Sai / mês</div>
                    <div style={{fontSize:16,fontWeight:800,color:'var(--ink)',marginTop:3}}>−{fmt(recurringOutTotal)}</div>
                  </div>
                </div>

                {(recurring as RecurringRule[]).map(rule=>(
                  <div key={rule.id} style={{display:'flex',alignItems:'center',gap:11,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:14,padding:'11px 13px',marginBottom:8,opacity:rule.active?1:0.55}}>
                    <div style={{width:36,height:36,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,background:rule.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                      {catEmoji(rule.category)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>
                        {rule.category} <span style={{color:rule.type==='entrada'?'#00C896':'#E24B4A'}}>{rule.type==='entrada'?'+':'−'}{fmt(rule.amount)}</span>
                      </div>
                      <div style={{fontSize:10.5,color:'var(--text2)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        todo dia {rule.day_of_month}{rule.description?` · ${rule.description}`:''}{rule.active?'':' · pausada'}
                      </div>
                    </div>
                    <button onClick={()=>toggleRuleActive(rule)} aria-label={rule.active?'Pausar':'Retomar'} style={{flexShrink:0,border:'1px solid rgba(var(--ink-rgb),0.12)',background:'transparent',color:'var(--text2)',borderRadius:10,padding:'7px 10px',fontSize:11,fontWeight:700,fontFamily:'Inter, sans-serif',cursor:'pointer'}}>{rule.active?'Pausar':'Ativar'}</button>
                    <button onClick={()=>deleteRule(rule)} aria-label="Remover recorrência" style={{flexShrink:0,border:'1px solid rgba(226,75,74,0.25)',background:'transparent',color:'#E24B4A',borderRadius:10,padding:'7px 9px',fontSize:12,fontWeight:700,fontFamily:'Inter, sans-serif',cursor:'pointer'}}>✕</button>
                  </div>
                ))}
              </>
            ) : (
              <div style={{textAlign:'center',padding:'34px 10px',color:'var(--text2)'}}>
                <div style={{fontSize:36,marginBottom:10}}>🔁</div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--text1)',marginBottom:6}}>Sem recorrentes ainda</div>
                <div style={{fontSize:12,lineHeight:1.6}}>
                  Ao registar um movimento (renda, salário, assinatura…), ativa
                  <b style={{color:'var(--text1)'}}> &quot;Repetir todos os meses&quot;</b> e ele passa a aparecer aqui e em &quot;a pagar&quot;.
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* ── Sheet: feed completo de insights ── */}
      {showInsights&&(
        <Sheet tall icon="💡" title="Insights" onClose={()=>setShowInsights(false)}>
          <div style={{paddingTop:10}}>
            <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.55,margin:'0 0 14px'}}>
              Leituras automáticas dos teus movimentos deste mês, das mais urgentes para as informativas.
            </p>
            {insights.map(ins=>{
              const t = {
                danger:   { bg:'rgba(226,75,74,0.07)',  border:'rgba(226,75,74,0.28)',  accent:'#E24B4A' },
                warning:  { bg:'rgba(245,200,66,0.07)', border:'rgba(245,200,66,0.30)', accent:'#F5C842' },
                positive: { bg:'rgba(0,200,150,0.06)',  border:'rgba(0,200,150,0.25)',  accent:'#00C896' },
                info:     { bg:'rgba(var(--ink-rgb),0.04)', border:'rgba(var(--ink-rgb),0.12)', accent:'var(--text1)' },
              }[ins.tone]
              return (
                <div key={ins.id} style={{display:'flex',alignItems:'flex-start',gap:11,background:t.bg,border:`1px solid ${t.border}`,borderRadius:14,padding:'12px 14px',marginBottom:9}}>
                  <span style={{fontSize:18,lineHeight:'22px'}} aria-hidden>{ins.icon}</span>
                  <div style={{fontSize:12.5,fontWeight:600,color:'var(--text1)',lineHeight:1.5,flex:1}}>{ins.text}</div>
                </div>
              )
            })}
            {insights.length===0&&(
              <div style={{textAlign:'center',padding:'30px 0',color:'var(--text2)',fontSize:13,lineHeight:1.6}}>
                Sem insights por agora. Regista mais movimentos e define orçamentos — as leituras aparecem à medida que há dados.
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* ── Sheet: fecho do mês (resumo do mês anterior, 1×/mês) ── */}
      {monthCloseOpen && (() => {
        const { cur, before, label } = monthClose
        const win = monthCloseHeadline(cur, before, fmt)
        const winBg = win.tone==='positive' ? 'rgba(0,200,150,0.10)' : 'rgba(245,200,66,0.10)'
        const winBorder = win.tone==='positive' ? 'rgba(0,200,150,0.35)' : 'rgba(245,200,66,0.35)'
        const winColor = win.tone==='positive' ? '#00C896' : '#F5C842'
        return (
          <Sheet icon="📅" title={`Fecho de ${label}`} onClose={dismissMonthClose}
            footer={
              <button onClick={dismissMonthClose} style={{width:'100%',border:'none',borderRadius:15,padding:15,fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15,cursor:'pointer',background:'linear-gradient(135deg, #F5C842, #E0A82A)',color:'#1A1200'}}>
                Começar {format(new Date(),'MMMM',{locale:pt})} ›
              </button>
            }>
            <div style={{paddingTop:8}}>
              {/* Vitória em destaque */}
              <div style={{display:'flex',alignItems:'center',gap:12,background:winBg,border:`1px solid ${winBorder}`,borderRadius:18,padding:'16px 16px',marginBottom:14}}>
                <span style={{fontSize:30,lineHeight:'34px'}} aria-hidden>{win.icon}</span>
                <div style={{fontSize:15,fontWeight:800,color:winColor,lineHeight:1.35}}>{win.text}</div>
              </div>

              {/* Balanço grande */}
              <div style={{textAlign:'center',margin:'6px 0 16px'}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:4}}>Balanço de {label.split(' ')[0]}</div>
                <div style={{fontSize:34,fontWeight:900,letterSpacing:'-1px',color:cur.balance>=0?'#00C896':'#E24B4A'}}>{cur.balance>=0?'+':'−'}{fmt(Math.abs(cur.balance))}</div>
                <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>entradas − gastos</div>
              </div>

              {/* Grelha de números */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
                <div style={{background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:14,padding:'12px 13px'}}>
                  <div style={{fontSize:10,color:'var(--text2)',fontWeight:600}}>Entradas</div>
                  <div style={{fontSize:16,fontWeight:800,color:'#00C896',marginTop:2}}>+{fmt(cur.income)}</div>
                </div>
                <div style={{background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:14,padding:'12px 13px'}}>
                  <div style={{fontSize:10,color:'var(--text2)',fontWeight:600}}>Gastos</div>
                  <div style={{fontSize:16,fontWeight:800,color:'#E24B4A',marginTop:2}}>−{fmt(cur.spending)}</div>
                </div>
                <div style={{background:'var(--surface-2)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:14,padding:'12px 13px'}}>
                  <div style={{fontSize:10,color:'var(--text2)',fontWeight:600}}>🏦 Poupado</div>
                  <div style={{fontSize:16,fontWeight:800,color:'#00C896',marginTop:2}}>{fmt(cur.saved)}</div>
                </div>
                <div style={{background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:14,padding:'12px 13px'}}>
                  <div style={{fontSize:10,color:'var(--text2)',fontWeight:600}}>Maior gasto</div>
                  {cur.topCat ? (
                    <div style={{fontSize:13,fontWeight:800,color:'var(--ink)',marginTop:4,display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',overflow:'hidden'}}>
                      <span>{catEmoji(cur.topCat.cat)}</span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{cur.topCat.cat}</span>
                    </div>
                  ) : <div style={{fontSize:13,color:'var(--text3)',marginTop:4}}>—</div>}
                  {cur.topCat && <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{fmt(cur.topCat.amount)}</div>}
                </div>
              </div>

              {/* Comparação com o mês anterior */}
              {(before.spending>0||before.income>0) && (
                <div style={{marginTop:14,background:'var(--surface-2)',border:'1px solid rgba(var(--ink-rgb),0.07)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.6,color:'var(--text1)'}}>
                  <b style={{color:'var(--ink)'}}>Vs. mês anterior:</b>{' '}
                  gastos {cur.spending<=before.spending?'▼':'▲'} {fmt(Math.abs(cur.spending-before.spending))} ·{' '}
                  poupança {cur.saved>=before.saved?'▲':'▼'} {fmt(Math.abs(cur.saved-before.saved))}
                </div>
              )}
            </div>
          </Sheet>
        )
      })()}

      <Nav/>
    </main>
  )
}
