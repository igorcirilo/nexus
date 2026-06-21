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
  supabase, getProfile, getTransactions,
  getTransactionsByMonth, saveTransaction, updateTransaction,
  saveTransactionsBulk, deleteTransaction, updateFinancialGoals,
} from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  parseCsvText, detectColumnMap, rowsToTransactions,
  type TransactionCandidate,
} from '@/lib/csv-parser'
import { extractPdfText, parseStatementPdf } from '@/lib/pdf'
import { logError } from '@/lib/log'
import { format, startOfMonth, endOfMonth, subMonths, subDays, addMonths, getDaysInMonth, getDate } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile, Transaction, FinancialImportPreview, FinancialImportCandidate } from '@/types'

const CATEGORIES_IN  = ['Salário','Freelance','Investimento','Rendas','Presente','Outro']
const CATEGORIES_OUT = ['Alimentação','Transporte','Habitação','Contas','Saúde','Lazer','Roupa','Educação','Assinaturas','Poupança','Outro']
const CAT_COLORS     = ['#7F77DD','#1ECBB4','#E8A838','#E24B4A','#1D9E75','#D4537E','#85B7EB','#F0C060','#534AB7','#9BA0B0']
// Categoria reservada: mover dinheiro para poupança. Conta para a meta mensal de poupança.
const SAVINGS_CAT = 'Poupança'
const CUSTOM_KEY  = '__custom__'
const CAT_EMOJI: Record<string,string> = {
  Alimentação:'🍔', Transporte:'🚗', Habitação:'🏠', Contas:'🧾', Saúde:'💊', Lazer:'🎮',
  Roupa:'👕', Educação:'🎓', Assinaturas:'📺', Poupança:'🏦', Outro:'📦',
  Salário:'💼', Freelance:'💻', Investimento:'📈', Rendas:'🏘️', Presente:'🎁',
}
const catEmoji = (cat:string) => CAT_EMOJI[cat] ?? '📦'

function dayLabel(date:string) {
  const today = format(new Date(),'yyyy-MM-dd')
  const yest  = format(subDays(new Date(),1),'yyyy-MM-dd')
  if (date===today) return 'Hoje'
  if (date===yest)  return 'Ontem'
  const s = format(new Date(date+'T12:00:00'),'EEE, d MMM',{locale:pt})
  return s.charAt(0).toUpperCase()+s.slice(1)
}

const sheetLabel: React.CSSProperties = {
  fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase',
  color:'rgba(255,255,255,0.3)', display:'block', margin:'16px 0 8px', fontFamily:'Inter, sans-serif',
}
const sheetInp: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)',
  borderRadius:13, padding:'12px 14px', color:'#fff',
  fontFamily:'Inter, sans-serif', fontSize:14, fontWeight:600, outline:'none',
}

// Concha de bottom sheet partilhada (design do hub)
function Sheet({ icon, title, onClose, children, footer, tall }: {
  icon?: string; title: string; onClose: () => void
  children: React.ReactNode; footer?: React.ReactNode; tall?: boolean
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width:'100%', maxWidth:448, margin:'0 auto', background:'#11131C',
        borderRadius:'24px 24px 0 0', borderTop:'1px solid rgba(255,255,255,0.12)',
        display:'flex', flexDirection:'column',
        maxHeight: tall ? '92dvh' : 'min(86dvh, 720px)',
        ...(tall ? { height:'92dvh' } : {}),
        fontFamily:'Inter, sans-serif', boxShadow:'0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)', margin:'10px auto 0', flexShrink:0 }} />
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          {icon && <span style={{ fontSize:20 }}>{icon}</span>}
          <div style={{ flex:1, fontWeight:800, fontSize:17, color:'#fff', letterSpacing:'-0.3px' }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" style={{ width:30, height:30, borderRadius:10, background:'rgba(255,255,255,0.06)', border:'none', cursor:'pointer', fontSize:14, color:'rgba(255,255,255,0.6)' }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'4px 20px 16px' }}>{children}</div>
        {footer && (
          <div style={{ padding:'12px 20px calc(20px + env(safe-area-inset-bottom))', background:'#11131C', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Chips de ± para ajustar valores nos sheets
function StepChips({ steps, onStep }: { steps: number[]; onStep: (delta:number)=>void }) {
  return (
    <div style={{ display:'flex', gap:8, marginTop:12 }}>
      {steps.map(s => (
        <button key={s} onClick={() => onStep(s)} style={{
          flex:1, textAlign:'center', padding:'10px 0', borderRadius:12, cursor:'pointer',
          border:`1px solid ${s>0 ? 'rgba(245,200,66,0.45)' : 'rgba(255,255,255,0.10)'}`,
          background:s>0 ? 'rgba(245,200,66,0.10)' : 'rgba(255,255,255,0.03)',
          color:s>0 ? '#F5C842' : 'rgba(255,255,255,0.6)',
          fontSize:12.5, fontWeight:700, fontFamily:'Inter, sans-serif',
        }}>{s>0?'+':'−'}€{Math.abs(s)}</button>
      ))}
    </div>
  )
}
const DEFAULT_BUDGETS: Record<string,number> = {
  Alimentação:400, Transporte:150, Habitação:800, Contas:150, Saúde:100,
  Lazer:200, Roupa:100, Educação:100, Assinaturas:50, Poupança:300, Outro:100,
}

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg2)', border:'0.5px solid var(--border)',
  borderRadius:12, padding:'11px 14px', color:'var(--text1)',
  fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none',
}
const hubInp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '11px 14px', color: '#fff',
  fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
}
const TT: React.CSSProperties = {
  background:'#1C2030', border:'0.5px solid rgba(255,255,255,.1)', borderRadius:10, color:'#F0EDE8', fontSize:12,
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
  const [budgets,    setBudgets]   = useState<Record<string,number>>(DEFAULT_BUDGETS)
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
  const [openTx,     setOpenTx]    = useState<Transaction|null>(null)
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

  const fmt = (v:number) => v.toLocaleString('pt-PT',{style:'currency',currency:'EUR'})
  function showToast(m: string, type: 'success' | 'error' | 'info' = 'success') {
    if (type === 'error') toast.error(m)
    else toast.success(m)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data:{user} }) => {
      if (!user) { window.location.href='/auth'; return }
      setUserId(user.id)
      const [prof, recent, hist] = await Promise.all([
        getProfile(user.id),
        getTransactions(user.id, 2),
        getTransactionsByMonth(user.id, 6),
      ])
      setProfile(prof)
      setTxs(recent as Transaction[])
      setHistory(hist as Transaction[])
      try {
        const saved = localStorage.getItem(`nexus_budgets_${user.id}`)
        if (saved) setBudgets({...DEFAULT_BUDGETS,...JSON.parse(saved)})
      } catch {}
      setLoading(false)

    })
  }, [])

  // Métricas do mês atual
  const monthStart = format(startOfMonth(new Date()),'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),'yyyy-MM-dd')
  const thisMonth  = useMemo(()=>txs.filter(t=>t.date>=monthStart&&t.date<=monthEnd),[txs,monthStart,monthEnd])
  const totalIn    = useMemo(()=>thisMonth.filter(t=>t.type==='entrada').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const totalOut   = useMemo(()=>thisMonth.filter(t=>t.type==='saida').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const balance    = totalIn - totalOut

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

  // Gráfico 6 meses
  const monthlyChart = useMemo(()=>Array.from({length:6},(_,i)=>{
    const d=subMonths(new Date(),5-i)
    const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
    const m=history.filter(t=>t.date>=s&&t.date<=e)
    const inp=m.filter(t=>t.type==='entrada').reduce((a,t)=>a+t.amount,0)
    const out=m.filter(t=>t.type==='saida').reduce((a,t)=>a+t.amount,0)
    return {label:format(d,'MMM',{locale:pt}),entradas:Math.round(inp),saidas:Math.round(out),poupanca:Math.round(inp-out)}
  }),[history])

  // ── Médias dos últimos 3 meses completos (exclui o mês atual) ──
  const prev3Range = useMemo(() => ({
    start: format(startOfMonth(subMonths(new Date(),3)),'yyyy-MM-dd'),
    end:   format(endOfMonth(subMonths(new Date(),1)),'yyyy-MM-dd'),
  }), [])
  const avgExpenses3m = useMemo(() => {
    const out = history.filter(t => t.type==='saida' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .reduce((a,t)=>a+t.amount,0)
    return out/3
  }, [history, prev3Range])
  const avgIncome3m = useMemo(() => {
    const inc = history.filter(t => t.type==='entrada' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .reduce((a,t)=>a+t.amount,0)
    return inc/3
  }, [history, prev3Range])
  const catAvg3m = useMemo(() => {
    const map: Record<string,number> = {}
    history.filter(t => t.type==='saida' && t.date>=prev3Range.start && t.date<=prev3Range.end)
      .forEach(t => { map[t.category]=(map[t.category]??0)+t.amount })
    Object.keys(map).forEach(k => { map[k]=map[k]/3 })
    return map
  }, [history, prev3Range])
  // Gasto por categoria nos últimos 4 meses (3 anteriores + atual) para sparkline
  const catMonthly = useMemo(() => {
    const map: Record<string,number[]> = {}
    for (let i=3;i>=0;i--) {
      const d=subMonths(new Date(),i)
      const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
      const inMonth = history.filter(t=>t.type==='saida'&&t.date>=s&&t.date<=e)
      const perCat: Record<string,number> = {}
      inMonth.forEach(t=>{ perCat[t.category]=(perCat[t.category]??0)+t.amount })
      OUT_CATS.forEach(c=>{ (map[c] ??= []).push(Math.round(perCat[c]??0)) })
    }
    return map
  }, [history, OUT_CATS])

  // ── Movimentos: filtro + agrupamento por dia ──
  const filteredTxs = useMemo(() => {
    const q = txQuery.trim().toLowerCase()
    return txs.filter(t =>
      (txFilter==='all' || t.type===txFilter) &&
      (!txCat || t.category===txCat) &&
      (!q || t.category.toLowerCase().includes(q) || (t.description??'').toLowerCase().includes(q))
    )
  }, [txs, txQuery, txFilter, txCat])
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
    txs.forEach(t => { counts[t.category]=(counts[t.category]??0)+1 })
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c])=>c)
  }, [txs])
  const filterActive = txFilter!=='all' || !!txCat || !!txQuery.trim()
  const filteredTotal = filteredTxs.reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0)

  // ── Orçamento: gauge + categorias ordenadas ──
  const spentByCat = useMemo(() => {
    const map: Record<string,number> = {}
    thisMonth.filter(t=>t.type==='saida').forEach(t=>{ map[t.category]=(map[t.category]??0)+t.amount })
    return map
  }, [thisMonth])
  // Poupança do mês = só os lançamentos categorizados como "Poupança" (não o saldo).
  const savedThisMonth = useMemo(
    () => thisMonth.filter(t=>t.type==='saida'&&t.category===SAVINGS_CAT).reduce((a,t)=>a+t.amount,0),
    [thisMonth],
  )
  const budgetedCats = OUT_CATS
    .filter(c => (budgets[c]??0) > 0)
    .map(c => {
      const budget = budgets[c]
      const spent  = spentByCat[c] ?? 0
      return { cat:c, budget, spent, pct: Math.round(spent/budget*100) }
    })
    .sort((a,b)=>b.pct-a.pct)
  const unbudgetedCats = OUT_CATS.filter(c => (budgets[c]??0) <= 0)
  const totalBudget        = budgetedCats.reduce((a,b)=>a+b.budget,0)
  const totalSpentBudgeted = budgetedCats.reduce((a,b)=>a+b.spent,0)
  const budgetPct          = totalBudget>0 ? Math.min(100,Math.round(totalSpentBudgeted/totalBudget*100)) : 0
  const monthPct           = Math.round(dayOfMonth/daysInMonth*100)
  const budgetOnPace       = budgetPct <= monthPct + 5
  const budgetSuggestions  = OUT_CATS
    .filter(c => (catAvg3m[c]??0) > 0)
    .map(c => ({ cat:c, avg:catAvg3m[c], suggested: Math.ceil((catAvg3m[c]*1.05)/10)*10 }))

  function openTxSheet(t: Transaction) {
    setOpenTx(t)
    setEtCat(t.category); setEtDesc(t.description ?? '')
    setEtAmount(String(t.amount)); setEtDate(t.date)
  }

  async function saveTxEdit() {
    if (!openTx || !userId) return
    const amount = parseFloat(etAmount.replace(',','.'))
    if (!Number.isFinite(amount) || amount<=0 || !etCat || !etDate) return
    setTxEditSaving(true)
    const { error } = await updateTransaction(openTx.id, {
      category: etCat, description: etDesc.trim()||null, amount, date: etDate,
    })
    if (error) { showToast('Erro ao guardar.', 'error'); setTxEditSaving(false); return }
    const [r,h] = await Promise.all([getTransactions(userId,2),getTransactionsByMonth(userId,6)])
    setTxs(r as Transaction[]); setHistory(h as Transaction[])
    setOpenTx(null); setTxEditSaving(false); showToast('Movimento atualizado!')
  }

  async function removeTxConfirmed() {
    if (!confirmDeleteTx) return
    await removeTx(confirmDeleteTx.id)
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
    setSaving(true)
    const {error} = await saveTransaction({user_id:userId,type:txType,category:finalCat,description:fDesc||null,amount:parseFloat(fAmount),date:fDate})
    if (error) { showToast('Erro ao guardar.', 'error'); setSaving(false); return }
    const [r,h] = await Promise.all([getTransactions(userId,2),getTransactionsByMonth(userId,6)])
    setTxs(r as Transaction[]); setHistory(h as Transaction[])
    setFAmount(''); setFDesc(''); setFCat(''); setFCustomCat(''); setShowForm(false)
    showToast('Transação adicionada!'); setSaving(false)
  }

  async function removeTx(id:string) {
    const {error}=await deleteTransaction(id)
    if (!error) { setTxs(t=>t.filter(x=>x.id!==id)); setHistory(h=>h.filter(x=>x.id!==id)); showToast('Removido.') }
  }

  function saveBudget(cat:string,val:string) {
    const n=parseFloat(val); if (isNaN(n)||n<0) return
    const updated={...budgets,[cat]:n}
    setBudgets(updated)
    if (userId) try { localStorage.setItem(`nexus_budgets_${userId}`,JSON.stringify(updated)) } catch {}
    showToast('Orçamento guardado.')
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
    const [r, h] = await Promise.all([getTransactions(userId, 2), getTransactionsByMonth(userId, 6)])
    setTxs(r as Transaction[])
    setHistory(h as Transaction[])
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
    const updated = await getTransactions(userId, 2)
    setTxs(updated as Transaction[])
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
    <main style={{paddingBottom:'calc(150px + env(safe-area-inset-bottom))',minHeight:'100dvh',background:'#07070F',fontFamily:'Inter, sans-serif'}}>

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
              <button onClick={confirmCsvImport} disabled={csvImporting} style={{flex:2,background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:12,padding:13,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer',opacity:csvImporting?.6:1}}>
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
                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: c.selected ? 'var(--teal)' : 'var(--bg2)', border: c.selected ? 'none' : '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
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
                style={{ width: '100%', padding: 14, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
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
          <h1 style={{fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:28,marginBottom:3,color:'#fff',letterSpacing:'-0.5px'}}>Finanças</h1>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{format(new Date(),'MMMM yyyy',{locale:pt})}</p>
        </div>
        <div style={{display:'flex',gap:8,position:'relative'}}>
          <button
            onClick={()=>setMoreOpen(v=>!v)}
            aria-label="Mais opções"
            aria-expanded={moreOpen}
            style={{width:38,height:38,borderRadius:12,background:moreOpen?'rgba(245,200,66,0.10)':'rgba(255,255,255,0.05)',border:`1px solid ${moreOpen?'rgba(245,200,66,0.4)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:moreOpen?'#F5C842':'rgba(255,255,255,0.6)'}}
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
            <div style={{position:'absolute',right:0,top:46,zIndex:50,width:200,background:'#161825',border:'1px solid rgba(255,255,255,0.12)',borderRadius:16,boxShadow:'0 18px 50px rgba(0,0,0,0.65)',overflow:'hidden'}}>
              <button onClick={()=>{setMoreOpen(false);csvRef.current?.click()}} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'rgba(255,255,255,0.9)',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',textAlign:'left'}}>
                ↑ Importar CSV
              </button>
              <button onClick={()=>{setMoreOpen(false);pdfRef.current?.click()}} disabled={pdfLoading} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'13px 14px',fontSize:13.5,fontWeight:600,fontFamily:'Inter, sans-serif',color:'rgba(255,255,255,0.9)',background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
                📄 {pdfLoading ? 'A ler PDF…' : 'Importar PDF'}
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
        style={{display:'block',width:'calc(100% - 40px)',textAlign:'left',cursor:'pointer',fontFamily:'Inter, sans-serif',margin:'14px 20px 0',background:'linear-gradient(135deg, #131022 0%, #0E1A26 100%)',border:'1px solid rgba(0,212,200,0.2)',borderRadius:22,padding:18}}
      >
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(0,212,200,0.85)'}}>💎 Saldo do mês</div>
          <span style={{fontSize:11,fontWeight:700,color:'rgba(0,212,200,0.85)'}}>Movimentos ›</span>
        </div>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:'-1px',color:balance>=0?'#00D4C8':'#E24B4A'}}>{fmt(balance)}</div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <div style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'9px 10px'}}>
            <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)',fontWeight:600}}>Entradas</div>
            <div style={{fontSize:14,fontWeight:800,color:'#00C896',marginTop:2}}>+{fmt(totalIn)}</div>
          </div>
          <div style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'9px 10px'}}>
            <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)',fontWeight:600}}>Saídas</div>
            <div style={{fontSize:14,fontWeight:800,color:'#E24B4A',marginTop:2}}>−{fmt(totalOut)}</div>
          </div>
        </div>
      </button>

      <div style={{padding:'0 20px'}} onClick={()=>moreOpen&&setMoreOpen(false)}>
        {/* ── Orçamento (resumo) ── */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'20px 0 10px'}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)'}}>Orçamento</span>
          <button onClick={()=>setShowOrcamento(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,color:'#F5C842',fontFamily:'Inter, sans-serif',padding:0}}>Gerir ›</button>
        </div>
        <button onClick={()=>setShowOrcamento(true)} style={{width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'13px 15px'}}>
          {budgetedCats.length>0 ? (
            <>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9}}>
                <span style={{fontSize:15}}>📋</span>
                <span style={{fontSize:13,fontWeight:700,color:'#fff'}}>{format(new Date(),'MMMM',{locale:pt}).replace(/^./,c=>c.toUpperCase())}</span>
                <span style={{marginLeft:'auto',fontSize:13,fontWeight:800,color:budgetPct>=100?'#E24B4A':budgetOnPace?'#00C896':'#F5C842'}}>{budgetPct}% usado</span>
              </div>
              <div style={{height:7,background:'rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:10,width:`${Math.min(100,budgetPct)}%`,background:budgetPct>=100?'#E24B4A':budgetOnPace?'#00C896':'#F5C842'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:'rgba(255,255,255,0.4)',marginTop:6}}>
                <span>{fmt(totalSpentBudgeted)} de {fmt(totalBudget)}</span>
                <span style={{color:budgetOnPace?'#00C896':'#F5C842',fontWeight:700}}>{budgetOnPace?'dentro do ritmo':'acima do ritmo'}</span>
              </div>
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
                <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>Sugestões automáticas com base nos teus últimos 3 meses.</div>
              </div>
              <span style={{color:'rgba(255,255,255,0.25)',fontSize:14}}>›</span>
            </div>
          )}
        </button>

        {/* ── Metas (resumo) ── */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',margin:'20px 0 10px'}}>Metas</div>
        <div style={{display:'flex',gap:9}}>
          {/* Reserva */}
          <button
            onClick={()=>{setGReserve(reserveGoal?String(reserveGoal):'');setGCurrent(currentSavings?String(currentSavings):'');setMetaSheet('reserva')}}
            style={{flex:1,textAlign:'center',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:13}}
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
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff'}}>{pct}%</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>{fmt(currentSavings)}</div>
                  <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                    {monthsCovered!==null?`≈ ${monthsCovered.toLocaleString('pt-PT',{maximumFractionDigits:1})} meses cobertos`:`de ${fmt(reserveGoal)}`}
                  </div>
                </>
              )
            })() : (
              <>
                <div style={{fontSize:26,margin:'10px 0 8px'}}>🛡️</div>
                <div style={{display:'inline-block',fontSize:11,fontWeight:800,color:'#1A1200',background:'linear-gradient(135deg, #F5C842, #E0A82A)',borderRadius:9,padding:'7px 14px'}}>Definir</div>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)',marginTop:8}}>3–6× despesas mensais</div>
              </>
            )}
          </button>

          {/* Poupança mensal */}
          <button
            onClick={()=>{setGSave(savingsGoal?String(savingsGoal):'');setMetaSheet('poupanca')}}
            style={{flex:1,textAlign:'center',cursor:'pointer',fontFamily:'Inter, sans-serif',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:13}}
          >
            <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(0,200,150,0.85)',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>💰 Poupança · {format(new Date(),'MMM',{locale:pt})}</div>
            {savingsGoal>0 ? (() => {
              const cur  = savedThisMonth
              const pct  = Math.min(100,Math.round(cur/savingsGoal*100))
              const pace = cur >= savingsGoal*(dayOfMonth/daysInMonth)
              const done = cur>=savingsGoal
              return (
                <>
                  <div style={{height:58,display:'flex',flexDirection:'column',justifyContent:'center',gap:7,marginBottom:6}}>
                    <div style={{height:8,background:'rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:10,width:`${pct}%`,background:'linear-gradient(90deg,#00C896,#00D4C8)'}}/>
                    </div>
                    <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)'}}>{done?'meta atingida 🎉':`faltam ${fmt(savingsGoal-cur)} · ${daysLeft} dias`}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>{fmt(cur)} <span style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>/ {fmt(savingsGoal)}</span></div>
                  <div style={{fontSize:9.5,fontWeight:700,marginTop:2,color:done||pace?'#00C896':'#F5C842'}}>{done?'✓ atingida':pace?'no ritmo':'abaixo do ritmo'}</div>
                </>
              )
            })() : (
              <>
                <div style={{fontSize:26,margin:'10px 0 8px'}}>💰</div>
                <div style={{display:'inline-block',fontSize:11,fontWeight:800,color:'#1A1200',background:'linear-gradient(135deg, #F5C842, #E0A82A)',borderRadius:9,padding:'7px 14px'}}>Definir</div>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,0.4)',marginTop:8}}>10–20% do que entra</div>
              </>
            )}
          </button>
        </div>

        {/* ── Movimentos recentes ── */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'20px 0 10px'}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)'}}>Movimentos recentes</span>
          <button onClick={()=>setShowMovimentos(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,color:'#F5C842',fontFamily:'Inter, sans-serif',padding:0}}>Ver todos ›</button>
        </div>
        {txs.length===0 ? (
          <div style={{textAlign:'center',padding:'26px 0',color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.10)',borderRadius:16}}>
            <div style={{fontSize:32,marginBottom:8}}>💸</div>
            <div style={{fontSize:13,marginBottom:4}}>Sem movimentos ainda.</div>
            <div style={{fontSize:11.5}}>Toca em + para registar, ou importa CSV/PDF no menu ⋯</div>
          </div>
        ) : (
          <>
            {txs.slice(0,5).map(t=>(
              <button key={t.id} onClick={()=>openTxSheet(t)} style={{
                display:'flex',alignItems:'center',gap:11,padding:'10px 12px',borderRadius:14,cursor:'pointer',
                background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',
                fontFamily:'Inter, sans-serif',textAlign:'left',width:'100%',marginBottom:6,
              }}>
                <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,background:t.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                  {catEmoji(t.category)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:'#fff'}}>{t.category}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{dayLabel(t.date)}{t.description?` · ${t.description}`:''}</div>
                </div>
                <div style={{fontWeight:800,fontSize:13,color:t.type==='entrada'?'#00C896':'#E24B4A',flexShrink:0}}>
                  {t.type==='entrada'?'+':'−'}{fmt(t.amount)}
                </div>
              </button>
            ))}
            {txs.length>5&&(
              <button onClick={()=>setShowMovimentos(true)} style={{width:'100%',textAlign:'center',padding:12,border:'1px solid rgba(255,255,255,0.10)',borderRadius:14,background:'transparent',fontSize:12.5,fontWeight:700,color:'rgba(255,255,255,0.65)',fontFamily:'Inter, sans-serif',cursor:'pointer',marginTop:2}}>
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
          <div style={{display:'flex',alignItems:'center',gap:9,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:13,padding:'0 13px',marginBottom:10}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={txQuery} onChange={e=>setTxQuery(e.target.value)}
              placeholder="Pesquisar movimentos…"
              style={{flex:1,background:'transparent',border:'none',outline:'none',padding:'12px 0',color:'#fff',fontSize:13,fontFamily:'Inter, sans-serif'}}
            />
            {txQuery && <button onClick={()=>setTxQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:13,padding:4}}>✕</button>}
          </div>

          {/* Filtros */}
          <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4,marginBottom:4,scrollbarWidth:'none'}}>
            {([['all','Todas'],['entrada','↓ Entradas'],['saida','↑ Saídas']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTxFilter(k)} style={{
                flexShrink:0,fontSize:12,fontWeight:600,padding:'7px 13px',borderRadius:20,cursor:'pointer',
                border:`1px solid ${txFilter===k?'rgba(245,200,66,0.3)':'rgba(255,255,255,0.1)'}`,
                color:txFilter===k?'#F5C842':'rgba(255,255,255,0.5)',
                background:txFilter===k?'rgba(245,200,66,0.12)':'transparent',
                fontFamily:'Inter, sans-serif',whiteSpace:'nowrap',
              }}>{l}</button>
            ))}
            {txCatOptions.map(c=>(
              <button key={c} onClick={()=>setTxCat(txCat===c?null:c)} style={{
                flexShrink:0,fontSize:12,fontWeight:600,padding:'7px 13px',borderRadius:20,cursor:'pointer',
                border:`1px solid ${txCat===c?'rgba(245,200,66,0.3)':'rgba(255,255,255,0.1)'}`,
                color:txCat===c?'#F5C842':'rgba(255,255,255,0.5)',
                background:txCat===c?'rgba(245,200,66,0.12)':'transparent',
                fontFamily:'Inter, sans-serif',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5,
              }}>{catEmoji(c)} {c}{txCat===c?' ✕':''}</button>
            ))}
          </div>

          {/* Agregado do filtro */}
          {filterActive && filteredTxs.length>0 && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(245,200,66,0.06)',border:'1px solid rgba(245,200,66,0.2)',borderRadius:13,padding:'11px 14px',margin:'10px 0 2px'}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>
                <b style={{color:'#fff'}}>{filteredTxs.length} movimento{filteredTxs.length!==1?'s':''}</b>
                {txCat?` · ${txCat}`:''}
              </span>
              <span style={{fontSize:14,fontWeight:800,color:filteredTotal>=0?'#00C896':'#E24B4A'}}>
                {filteredTotal>=0?'+':'−'}{fmt(Math.abs(filteredTotal))}
              </span>
            </div>
          )}

          {/* Vazio */}
          {filteredTxs.length===0&&(
            <div style={{textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.4)'}}>
              <div style={{fontSize:40,marginBottom:12}}>💸</div>
              <div style={{fontSize:14,marginBottom:6}}>{filterActive?'Nada encontrado com este filtro.':'Sem transações ainda.'}</div>
              {!filterActive&&<div style={{fontSize:12}}>Clica em + Registar ou importa um CSV.</div>}
            </div>
          )}

          {/* Grupos por dia */}
          {txGroups.map(([date,list])=>{
            const dayNet = list.reduce((a,t)=>a+(t.type==='entrada'?t.amount:-t.amount),0)
            return (
              <div key={date}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'14px 2px 8px'}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)'}}>{dayLabel(date)}</span>
                  <span style={{fontSize:11,fontWeight:700,color:dayNet>=0?'#00C896':'#E24B4A'}}>
                    {dayNet>=0?'+':'−'}{fmt(Math.abs(dayNet))}
                  </span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {list.map(t=>(
                    <button key={t.id} onClick={()=>openTxSheet(t)} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'11px 13px',borderRadius:14,cursor:'pointer',
                      background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',
                      fontFamily:'Inter, sans-serif',textAlign:'left',width:'100%',
                    }}>
                      <div style={{width:38,height:38,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,background:t.type==='entrada'?'rgba(0,200,150,.10)':'rgba(226,75,74,.10)'}}>
                        {catEmoji(t.category)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:'#fff'}}>{t.category}</div>
                        {t.description&&<div style={{fontSize:10.5,color:'rgba(255,255,255,0.4)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.description}</div>}
                      </div>
                      <div style={{fontWeight:800,fontSize:14,color:t.type==='entrada'?'#00C896':'#E24B4A',flexShrink:0}}>
                        {t.type==='entrada'?'+':'−'}{fmt(t.amount)}
                      </div>
                      <span style={{color:'rgba(255,255,255,0.25)',fontSize:14,flexShrink:0}}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {txGroups.length>0&&(
            <div style={{margin:'16px 0',padding:'12px 14px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',fontSize:12,color:'rgba(255,255,255,0.4)',lineHeight:1.6}}>
              <strong style={{color:'rgba(255,255,255,0.6)'}}>Formato CSV:</strong> cabeçalho{' '}
              <code style={{background:'rgba(255,255,255,0.08)',padding:'1px 5px',borderRadius:4}}>data,tipo,categoria,valor,descricao</code>
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
                background:'linear-gradient(135deg, #0E1A14 0%, #0D1F1A 60%, #0E1626 100%)',
                border:'1px solid rgba(0,200,150,0.22)',borderRadius:22,padding:18,
                display:'flex',gap:16,alignItems:'center',marginBottom:14,
              }}>
                <div style={{width:92,height:92,position:'relative',flexShrink:0}}>
                  <svg width="92" height="92" viewBox="0 0 92 92" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="46" cy="46" r="38" fill="none" stroke="rgba(0,200,150,0.15)" strokeWidth="8"/>
                    <circle cx="46" cy="46" r="38" fill="none" stroke={budgetPct>=100?'#E24B4A':budgetPct>monthPct+5?'#F5C842':'#00C896'} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={2*Math.PI*38} strokeDashoffset={2*Math.PI*38*(1-budgetPct/100)}/>
                  </svg>
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                    <div style={{fontSize:18,fontWeight:800,color:'#fff'}}>{budgetPct}%</div>
                    <div style={{fontSize:8.5,color:'rgba(255,255,255,0.4)',fontWeight:600}}>USADO</div>
                  </div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(0,200,150,0.85)',display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    📋 Orçamento de {format(new Date(),'MMMM',{locale:pt})}
                  </div>
                  <div style={{fontSize:21,fontWeight:900,letterSpacing:'-0.5px',color:'#fff'}}>
                    {fmt(totalSpentBudgeted)} <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)'}}>de {fmt(totalBudget)}</span>
                  </div>
                  <div style={{fontSize:11.5,color:'rgba(255,255,255,0.55)',marginTop:5,lineHeight:1.45}}>
                    Restam <b style={{color:'#fff'}}>{fmt(Math.max(0,totalBudget-totalSpentBudgeted))}</b> para {daysLeft} dias ·{' '}
                    <b style={{color:budgetOnPace?'#00C896':'#F5C842'}}>{budgetOnPace?'dentro do ritmo':'acima do ritmo'}</b>
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
                    background:over?'rgba(226,75,74,0.04)':'rgba(255,255,255,0.04)',
                    border:`1px solid ${over?'rgba(226,75,74,0.3)':'rgba(255,255,255,0.07)'}`,
                    borderRadius:15,padding:'12px 14px',marginBottom:8,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:9}}>
                      <div style={{width:32,height:32,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,background:over?'rgba(226,75,74,0.12)':warn?'rgba(245,200,66,0.12)':'rgba(255,255,255,0.06)'}}>
                        {catEmoji(cat)}
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{cat}</div>
                      {over&&<span style={{fontSize:9.5,fontWeight:800,borderRadius:7,padding:'3px 7px',background:'rgba(226,75,74,0.12)',color:'#E24B4A',flexShrink:0}}>+{fmt(spent-budget)} acima</span>}
                      {warn&&<span style={{fontSize:9.5,fontWeight:800,borderRadius:7,padding:'3px 7px',background:'rgba(245,200,66,0.12)',color:'#F5C842',flexShrink:0}}>atenção</span>}
                      <div style={{marginLeft:'auto',fontSize:12.5,fontWeight:700,color:'rgba(255,255,255,0.75)',flexShrink:0}}>
                        {fmt(spent)} <span style={{color:'rgba(255,255,255,0.3)',fontWeight:600}}>/ {fmt(budget)}</span>
                      </div>
                      <span style={{color:'rgba(255,255,255,0.25)',fontSize:14}}>›</span>
                    </div>
                    <div style={{height:6,background:'rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:10,width:`${Math.min(100,pct)}%`,background:over?'#E24B4A':warn?'#F5C842':'#00C896',transition:'width .4s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:5}}>
                      <span>{pct}% usado</span>
                      <span>{over?`excedeu o orçamento`:`${fmt(budget-spent)} restantes`}</span>
                    </div>
                  </button>
                )
              })}

              {/* Sem orçamento */}
              {unbudgetedCats.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',margin:'18px 0 10px'}}>Sem orçamento</div>
                  {unbudgetedCats.map(cat=>(
                    <button key={cat} onClick={()=>{setBudgetSheet(cat);setBudgetVal('')}} style={{
                      width:'100%',display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontFamily:'Inter, sans-serif',
                      background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.12)',
                      borderRadius:13,padding:'10px 13px',marginBottom:7,
                    }}>
                      <span style={{fontSize:15}}>{catEmoji(cat)}</span>
                      <span style={{fontSize:12.5,fontWeight:600,color:'rgba(255,255,255,0.55)'}}>
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
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2,lineHeight:1.45}}>Com base na média dos teus últimos 3 meses de movimentos, por categoria.</div>
                </div>
              </div>

              {budgetSuggestions.length>0 ? (
                <>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',margin:'4px 0 10px'}}>Sugestões prontas a aplicar</div>
                  {budgetSuggestions.map(({cat,avg,suggested})=>(
                    <div key={cat} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:15,padding:'12px 14px',marginBottom:8}}>
                      <span style={{fontSize:16}}>{catEmoji(cat)}</span>
                      <span style={{fontSize:13,fontWeight:700,color:'#fff'}}>{cat}</span>
                      <span style={{marginLeft:'auto',fontSize:11.5,color:'rgba(255,255,255,0.35)',fontWeight:600}}>média {fmt(avg)} →</span>
                      <span style={{fontSize:13,fontWeight:800,color:'#fff'}}>{fmt(suggested)}</span>
                      <button onClick={()=>saveBudget(cat,String(suggested))} style={{fontSize:10,fontWeight:800,borderRadius:8,padding:'5px 10px',background:'rgba(0,200,150,0.12)',color:'#00C896',border:'none',cursor:'pointer'}}>Aplicar</button>
                    </div>
                  ))}
                  <button
                    onClick={()=>{
                      const updated={...budgets}
                      budgetSuggestions.forEach(s=>{updated[s.cat]=s.suggested})
                      setBudgets(updated)
                      if (userId) try { localStorage.setItem(`nexus_budgets_${userId}`,JSON.stringify(updated)) } catch {}
                      showToast('Orçamentos aplicados!')
                    }}
                    style={{width:'100%',marginTop:8,border:'none',borderRadius:15,padding:15,cursor:'pointer',background:'linear-gradient(135deg, #F5C842, #E0A82A)',color:'#1A1200',fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:15}}
                  >
                    Aplicar todos ({budgetSuggestions.length})
                  </button>
                  <div style={{textAlign:'center',fontSize:11.5,color:'rgba(255,255,255,0.3)',marginTop:10}}>ou define manualmente categoria a categoria</div>
                </>
              ) : (
                <div style={{textAlign:'center',padding:'30px 0',color:'rgba(255,255,255,0.4)',fontSize:13,lineHeight:1.6}}>
                  Regista alguns movimentos primeiro — as sugestões aparecem com base no teu histórico.
                </div>
              )}

              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',margin:'18px 0 10px'}}>Todas as categorias</div>
              {CATEGORIES_OUT.map(cat=>(
                <button key={cat} onClick={()=>{setBudgetSheet(cat);setBudgetVal('')}} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontFamily:'Inter, sans-serif',
                  background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.12)',
                  borderRadius:13,padding:'10px 13px',marginBottom:7,
                }}>
                  <span style={{fontSize:15}}>{catEmoji(cat)}</span>
                  <span style={{fontSize:12.5,fontWeight:600,color:'rgba(255,255,255,0.55)'}}>{cat}</span>
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
              background:canSaveNew?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(255,255,255,0.06)',
              color:canSaveNew?'#1A1200':'rgba(255,255,255,0.35)',
            }}>{saving?'A guardar…':'Guardar movimento'}</button>
          }>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            {(['entrada','saida'] as const).map(t=>(
              <button key={t} onClick={()=>{setTxType(t);setFCat('');setFCustomCat('')}} style={{
                flex:1,padding:'11px',borderRadius:13,cursor:'pointer',
                fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,
                background: txType===t ? (t==='entrada'?'rgba(0,200,150,0.12)':'rgba(226,75,74,0.12)') : 'rgba(255,255,255,0.03)',
                border: `1px solid ${txType===t ? (t==='entrada'?'rgba(0,200,150,0.5)':'rgba(226,75,74,0.5)') : 'rgba(255,255,255,0.10)'}`,
                color: txType===t ? (t==='entrada'?'#00C896':'#E24B4A') : 'rgba(255,255,255,0.55)',
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
                background:fCat===cat?'rgba(245,200,66,0.10)':'rgba(255,255,255,0.03)',
                border:`1px solid ${fCat===cat?'rgba(245,200,66,0.45)':'rgba(255,255,255,0.10)'}`,
                color:fCat===cat?'#F5C842':'rgba(255,255,255,0.55)',
              }}>{catEmoji(cat)} {cat}</button>
            ))}
            <button onClick={()=>setFCat(CUSTOM_KEY)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:11,cursor:'pointer',
              fontSize:12,fontWeight:600,fontFamily:'Inter, sans-serif',
              background:fCat===CUSTOM_KEY?'rgba(127,119,221,0.18)':'rgba(255,255,255,0.03)',
              border:`1px solid ${fCat===CUSTOM_KEY?'rgba(127,119,221,0.55)':'rgba(255,255,255,0.10)'}`,
              color:fCat===CUSTOM_KEY?'#9D8DF5':'rgba(255,255,255,0.55)',
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
              background:(etAmount&&etCat)?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(255,255,255,0.06)',
              color:(etAmount&&etCat)?'#1A1200':'rgba(255,255,255,0.35)',
            }}>{txEditSaving?'A guardar…':'Guardar alterações'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color:openTx.type==='entrada'?'#00C896':'#E24B4A'}}>{openTx.type==='entrada'?'+':'−'}€</span>
              <input
                type="number" step="0.01" value={etAmount} onChange={e=>setEtAmount(e.target.value)}
                aria-label="Valor"
                style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color:openTx.type==='entrada'?'#00C896':'#E24B4A',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:600,marginTop:2}}>{dayLabel(openTx.date)}</div>
          </div>

          <label style={sheetLabel}>Categoria</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {(openTx.type==='entrada'?CATEGORIES_IN:OUT_CATS).map(cat=>(
              <button key={cat} onClick={()=>setEtCat(cat)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:11,cursor:'pointer',
                fontSize:12,fontWeight:600,fontFamily:'Inter, sans-serif',
                background:etCat===cat?'rgba(245,200,66,0.10)':'rgba(255,255,255,0.03)',
                border:`1px solid ${etCat===cat?'rgba(245,200,66,0.45)':'rgba(255,255,255,0.10)'}`,
                color:etCat===cat?'#F5C842':'rgba(255,255,255,0.55)',
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
          <div style={{width:'100%',maxWidth:340,background:'#161825',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'22px 20px',fontFamily:'Inter, sans-serif'}}>
            <div style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:8}}>Apagar movimento?</div>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.5,marginBottom:18,overflowWrap:'anywhere'}}>
              {confirmDeleteTx.category}{confirmDeleteTx.description?` · ${confirmDeleteTx.description}`:''} ({confirmDeleteTx.type==='entrada'?'+':'−'}{fmt(confirmDeleteTx.amount)}) vai ser removido. Esta ação é irreversível.
            </p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setConfirmDeleteTx(null)} style={{flex:1,padding:'12px 0',borderRadius:13,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.7)',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>Cancelar</button>
              <button onClick={removeTxConfirmed} style={{flex:1,padding:'12px 0',borderRadius:13,border:'none',background:'#E24B4A',color:'#fff',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>Apagar</button>
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
                  background:budgetVal?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(255,255,255,0.06)',
                  color:budgetVal?'#1A1200':'rgba(255,255,255,0.35)',
                }}>Guardar orçamento</button>
            }>
            <div style={{textAlign:'center',margin:'10px 0 2px'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:30,fontWeight:900,color:'#fff'}}>€</span>
                <input
                  type="number" step="1" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)}
                  placeholder="0" aria-label="Valor do orçamento"
                  style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color:'#fff',fontFamily:'Inter, sans-serif'}}
                />
              </div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:600,marginTop:2}}>por mês</div>
            </div>
            <StepChips steps={[-50,-10,10,50]} onStep={d=>stepValue(budgetVal,d,setBudgetVal)}/>

            {avg>0&&(
              <>
                <div style={{marginTop:16,background:'rgba(0,200,150,0.06)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'rgba(255,255,255,0.65)'}}>
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
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:9.5,color:'rgba(255,255,255,0.3)',marginTop:4,padding:'0 2px'}}>
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
                border:'1px solid rgba(255,255,255,0.10)',borderRadius:13,padding:'12px 14px',
                background:'transparent',fontSize:12.5,fontWeight:600,color:'rgba(255,255,255,0.55)',
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
              background:gReserve?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(255,255,255,0.06)',
              color:gReserve?'#1A1200':'rgba(255,255,255,0.35)',
            }}>{gSaving?'A guardar…':'Guardar meta'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color:'#fff'}}>€</span>
              <input
                type="number" step="50" value={gReserve} onChange={e=>setGReserve(e.target.value)}
                placeholder="5000" aria-label="Objetivo da reserva"
                style={{width:150,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color:'#fff',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:600,marginTop:2}}>objetivo da reserva</div>
          </div>
          <StepChips steps={[-500,-100,100,500]} onStep={d=>stepValue(gReserve,d,setGReserve)}/>

          <label style={sheetLabel}>Poupança atual acumulada</label>
          <input type="number" step="0.01" value={gCurrent} onChange={e=>setGCurrent(e.target.value)} placeholder="Ex: 1200" style={sheetInp}/>

          {avgExpenses3m>0&&(
            <div style={{marginTop:16,background:'rgba(157,92,245,0.07)',border:'1px solid rgba(157,92,245,0.2)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'rgba(255,255,255,0.65)'}}>
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
              background:gSave?'linear-gradient(135deg, #F5C842, #E0A82A)':'rgba(255,255,255,0.06)',
              color:gSave?'#1A1200':'rgba(255,255,255,0.35)',
            }}>{gSaving?'A guardar…':'Guardar meta'}</button>
          }>
          <div style={{textAlign:'center',margin:'10px 0 2px'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:30,fontWeight:900,color:'#fff'}}>€</span>
              <input
                type="number" step="10" value={gSave} onChange={e=>setGSave(e.target.value)}
                placeholder="300" aria-label="Meta de poupança mensal"
                style={{width:130,background:'transparent',border:'none',outline:'none',fontSize:34,fontWeight:900,letterSpacing:'-1px',color:'#fff',fontFamily:'Inter, sans-serif'}}
              />
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:600,marginTop:2}}>por mês</div>
          </div>
          <StepChips steps={[-50,-10,10,50]} onStep={d=>stepValue(gSave,d,setGSave)}/>

          {avgIncome3m>0&&(
            <div style={{marginTop:16,background:'rgba(0,200,150,0.06)',border:'1px solid rgba(0,200,150,0.18)',borderRadius:13,padding:'12px 14px',fontSize:12,lineHeight:1.55,color:'rgba(255,255,255,0.65)'}}>
              💡 Entram em média <b style={{color:'#00C896'}}>{fmt(avgIncome3m)}/mês</b>. Poupar 10–20% fica entre <b style={{color:'#00C896'}}>{fmt(avgIncome3m*0.1)} e {fmt(avgIncome3m*0.2)}</b>.
            </div>
          )}

          {/* Histórico de poupança + projeção (migrado da antiga tab Metas) */}
          <label style={sheetLabel}>Histórico de poupança</label>
          <div style={{height:110,overflow:'hidden'}}>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={monthlyChart}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                <XAxis dataKey="label" tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                {savingsGoal>0&&<ReferenceLine y={savingsGoal} stroke="rgba(245,200,66,0.55)" strokeDasharray="5 4"/>}
                <Bar dataKey="poupanca" radius={[5,5,0,0]}>
                  {monthlyChart.map((m,i)=><Cell key={i} fill={m.poupanca>=0?'#00C896':'#E24B4A'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            if (savingsGoal<=0) return null
            const above = monthlyChart.filter(m=>m.poupanca>=savingsGoal).length
            const avgSave = monthlyChart.slice(0,5).reduce((a,m)=>a+m.poupanca,0)/Math.max(1,monthlyChart.slice(0,5).length)
            const remaining = reserveGoal-currentSavings
            const projection = reserveGoal>0&&remaining>0&&avgSave>0
              ? format(addMonths(new Date(),Math.ceil(remaining/avgSave)),'MMM yyyy',{locale:pt})
              : null
            return (
              <div style={{marginTop:10,background:'rgba(0,200,150,0.05)',border:'1px solid rgba(0,200,150,0.15)',borderRadius:13,padding:'11px 13px',fontSize:12,lineHeight:1.55,color:'rgba(255,255,255,0.7)'}}>
                <b style={{color:'#00C896'}}>Mentor:</b> {above} dos últimos 6 meses acima da meta.
                {projection&&<> Ao ritmo atual, a reserva fica completa em <b style={{color:'#00C896'}}>{projection}</b>.</>}
              </div>
            )
          })()}
        </Sheet>
      )}

      <Nav/>
    </main>
  )
}
