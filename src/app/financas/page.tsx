'use client'
// src/app/financas/page.tsx
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import Nav from '@/components/Nav'
import FinancasHub from '@/components/financas/FinancasHub'
import {
  supabase, getProfile, getTransactions,
  getTransactionsByMonth, saveTransaction,
  saveTransactionsBulk, deleteTransaction, updateFinancialGoals,
} from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  parseCsvText, detectColumnMap, rowsToTransactions,
  type TransactionCandidate,
} from '@/lib/csv-parser'
import { extractPdfText, parseStatementPdf } from '@/lib/pdf'
import { logError } from '@/lib/log'
import { format, startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile, Transaction, FinancialImportPreview, FinancialImportCandidate } from '@/types'

const CATEGORIES_IN  = ['Salário','Freelance','Investimento','Rendas','Presente','Outro']
const CATEGORIES_OUT = ['Alimentação','Transporte','Habitação','Saúde','Lazer','Roupa','Educação','Assinaturas','Poupança','Outro']
const CAT_COLORS     = ['#7F77DD','#1ECBB4','#E8A838','#E24B4A','#1D9E75','#D4537E','#85B7EB','#F0C060','#534AB7','#9BA0B0']
const DEFAULT_BUDGETS: Record<string,number> = {
  Alimentação:400, Transporte:150, Habitação:800, Saúde:100,
  Lazer:200, Roupa:100, Educação:100, Assinaturas:50, Poupança:300, Outro:100,
}
type AppTab = 'resumo' | 'transacoes' | 'orcamento' | 'metas'
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
  const [tab,        setTab]       = useState<AppTab>('resumo')
  const [loading,    setLoading]   = useState(true)
  const [ready,      setReady]     = useState(false)
  const [budgets,    setBudgets]   = useState<Record<string,number>>(DEFAULT_BUDGETS)
  // Form transação
  const [showForm,   setShowForm]  = useState(false)
  const [txType,     setTxType]    = useState<'entrada'|'saida'>('saida')
  const [fCat,       setFCat]      = useState('')
  const [fDesc,      setFDesc]     = useState('')
  const [fAmount,    setFAmount]   = useState('')
  const [fDate,      setFDate]     = useState(format(new Date(),'yyyy-MM-dd'))
  const [saving,     setSaving]    = useState(false)
  // Form metas
  const [showGoals,  setShowGoals] = useState(false)
  const [gSave,      setGSave]     = useState('')
  const [gReserve,   setGReserve]  = useState('')
  const [gCurrent,   setGCurrent]  = useState('')
  const [gSaving,    setGSaving]   = useState(false)
  // Orçamento
  const [editBudget, setEditBudget]= useState<string|null>(null)
  const [budgetVal,  setBudgetVal] = useState('')
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
      setTimeout(()=>setReady(true), 60)
    })
  }, [])

  // Métricas do mês atual
  const monthStart = format(startOfMonth(new Date()),'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),'yyyy-MM-dd')
  const thisMonth  = useMemo(()=>txs.filter(t=>t.date>=monthStart&&t.date<=monthEnd),[txs,monthStart,monthEnd])
  const totalIn    = useMemo(()=>thisMonth.filter(t=>t.type==='entrada').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const totalOut   = useMemo(()=>thisMonth.filter(t=>t.type==='saida').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const balance    = totalIn - totalOut
  const savedPct   = totalIn>0 ? Math.round(balance/totalIn*100) : 0

  // Previsão — mínimo 7 dias para dados estáveis; baseada no saldo líquido diário
  const dayOfMonth    = getDate(new Date())
  const daysInMonth   = getDaysInMonth(new Date())
  const daysLeft      = daysInMonth - dayOfMonth
  const hasEnoughData = dayOfMonth >= 7
  // Taxa diária de saídas (info)
  const dailyBurn     = dayOfMonth > 0 ? totalOut / dayOfMonth : 0
  // Projeção: saldo atual + (ritmo líquido diário × dias restantes)
  const dailyNet      = hasEnoughData ? balance / dayOfMonth : 0
  const projectedBal  = hasEnoughData ? Math.round(balance + dailyNet * daysLeft) : 0

  // Por categoria
  const byCategory = useMemo(()=>{
    const map:Record<string,number>={}
    thisMonth.filter(t=>t.type==='saida').forEach(t=>{map[t.category]=(map[t.category]??0)+t.amount})
    return Object.entries(map).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value)
  },[thisMonth])

  // Gráfico 6 meses
  const monthlyChart = useMemo(()=>Array.from({length:6},(_,i)=>{
    const d=subMonths(new Date(),5-i)
    const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
    const m=history.filter(t=>t.date>=s&&t.date<=e)
    const inp=m.filter(t=>t.type==='entrada').reduce((a,t)=>a+t.amount,0)
    const out=m.filter(t=>t.type==='saida').reduce((a,t)=>a+t.amount,0)
    return {label:format(d,'MMM',{locale:pt}),entradas:Math.round(inp),saidas:Math.round(out),poupanca:Math.round(inp-out)}
  }),[history])

  async function addTx() {
    if (!userId||!fAmount||!fCat) return
    setSaving(true)
    const {error} = await saveTransaction({user_id:userId,type:txType,category:fCat,description:fDesc||null,amount:parseFloat(fAmount),date:fDate})
    if (error) { showToast('Erro ao guardar.', 'error'); setSaving(false); return }
    const [r,h] = await Promise.all([getTransactions(userId,2),getTransactionsByMonth(userId,6)])
    setTxs(r as Transaction[]); setHistory(h as Transaction[])
    setFAmount(''); setFDesc(''); setFCat(''); setShowForm(false)
    showToast('Transação adicionada!'); setSaving(false)
  }

  async function removeTx(id:string) {
    const {error}=await deleteTransaction(id)
    if (!error) { setTxs(t=>t.filter(x=>x.id!==id)); setHistory(h=>h.filter(x=>x.id!==id)); showToast('Removido.') }
  }

  async function saveGoals() {
    if (!userId) return
    setGSaving(true)
    await updateFinancialGoals(userId,{
      fin_monthly_save:   gSave?parseFloat(gSave):undefined,
      fin_reserve_goal:   gReserve?parseFloat(gReserve):undefined,
      fin_current_savings:gCurrent?parseFloat(gCurrent):undefined,
    })
    setProfile(await getProfile(userId))
    setShowGoals(false); showToast('Metas atualizadas!'); setGSaving(false)
  }

  function saveBudget(cat:string,val:string) {
    const n=parseFloat(val); if (isNaN(n)||n<0) return
    const updated={...budgets,[cat]:n}
    setBudgets(updated)
    if (userId) try { localStorage.setItem(`nexus_budgets_${userId}`,JSON.stringify(updated)) } catch {}
    setEditBudget(null); showToast('Orçamento guardado.')
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

  const TABS:{key:AppTab;label:string;icon:string}[] = [
    {key:'resumo',     label:'Resumo',    icon:'📊'},
    {key:'transacoes', label:'Movimentos',icon:'💸'},
    {key:'orcamento',  label:'Orçamento', icon:'📋'},
    {key:'metas',      label:'Metas',     icon:'🎯'},
  ]

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <div style={{fontFamily:'Syne, sans-serif',color:'var(--text3)'}}>a carregar…</div>
    </div>
  )

  // ── Dados derivados para o hub (Resumo) ──
  const monthLabel = (() => { const s = format(new Date(), 'MMMM yyyy', { locale: pt }); return s.charAt(0).toUpperCase() + s.slice(1) })()
  const categoriesView = byCategory.slice(0, 5).map((c) => {
    const idx = CATEGORIES_OUT.indexOf(c.name)
    return { name: c.name, value: c.value, color: CAT_COLORS[(idx >= 0 ? idx : 0) % CAT_COLORS.length], pct: totalOut > 0 ? (c.value / totalOut) * 100 : 0 }
  })
  const flowView = monthlyChart.map((m, i) => ({ label: m.label.charAt(0).toUpperCase() + m.label.slice(1), entradas: m.entradas, saidas: m.saidas, current: i === monthlyChart.length - 1 }))
  const goalsView = [
    ...(savingsGoal > 0 ? [{ name: 'Meta de poupança mensal', current: Math.max(0, balance), goal: savingsGoal, gradient: '#F5C842, #E07B2A' }] : []),
    ...(reserveGoal > 0 ? [{ name: 'Reserva de emergência', current: currentSavings, goal: reserveGoal, gradient: '#9D5CF5, #00D4C8' }] : []),
  ]

  // Resumo: hub full-bleed fiel ao mockup (navegação pelos cards + bottom nav)
  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
        <FinancasHub
          monthLabel={monthLabel}
          balance={balance}
          totalIn={totalIn}
          totalOut={totalOut}
          flow={flowView}
          categories={categoriesView}
          goals={goalsView}
          onNavigate={setTab}
          onAdd={() => setShowForm(true)}
        />
        <Nav />
        {showForm && (
          <div
            style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end' }}
            onClick={e => e.target === e.currentTarget && setShowForm(false)}
          >
            <div style={{ width:'100%', maxWidth:448, margin:'0 auto', background:'#0D0E20', borderRadius:'20px 20px 0 0', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', maxHeight:'90vh', fontFamily:'Inter, sans-serif' }}>
              <div style={{ padding:'24px 24px 16px', overflowY:'auto', flex:1 }}>
                {/* Título + fechar */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <div style={{ fontWeight:800, fontSize:18, color:'#fff' }}>Nova transação</div>
                  <button onClick={() => setShowForm(false)} style={{ width:30, height:30, borderRadius:9, background:'rgba(255,255,255,0.07)', border:'none', cursor:'pointer', fontSize:16, color:'rgba(255,255,255,0.6)' }}>×</button>
                </div>

                {/* Tipo: Entrada / Saída */}
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  {(['entrada','saida'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTxType(t); setFCat('') }}
                      style={{
                        flex:1, padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
                        fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:13,
                        background: txType === t ? (t === 'entrada' ? '#00C896' : '#E24B4A') : 'rgba(255,255,255,0.04)',
                        color: txType === t ? (t === 'entrada' ? '#001A10' : '#fff') : 'rgba(255,255,255,0.6)',
                        transition: 'all .15s',
                      }}
                    >
                      {t === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                    </button>
                  ))}
                </div>

                {/* Valor */}
                <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Valor (€)</label>
                <input
                  type="number" step="0.01" value={fAmount}
                  onChange={e => setFAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...hubInp, marginBottom:12, fontSize:18, fontWeight:600 }}
                />

                {/* Categoria */}
                <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Categoria</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                  {(txType === 'entrada' ? CATEGORIES_IN : CATEGORIES_OUT).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFCat(cat)}
                      style={{
                        padding:'7px 12px', borderRadius:10, border:'none', cursor:'pointer',
                        fontSize:12, fontFamily:'Inter, sans-serif',
                        background: fCat === cat ? (txType === 'entrada' ? '#00C896' : '#E24B4A') : 'rgba(255,255,255,0.05)',
                        color: fCat === cat ? (txType === 'entrada' ? '#001A10' : '#fff') : 'rgba(255,255,255,0.6)',
                        transition: 'all .15s',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Descrição + Data */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                  <div>
                    <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Descrição</label>
                    <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Opcional" style={hubInp} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Data</label>
                    <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={hubInp} />
                  </div>
                </div>
              </div>

              {/* Botão guardar (sticky) */}
              <div style={{ padding:'12px 24px 48px', background:'#0D0E20', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={addTx}
                  disabled={saving || !fAmount || !fCat}
                  style={{
                    width:'100%', border:'none', borderRadius:14, padding:15,
                    fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:15,
                    cursor: (fAmount && fCat) ? 'pointer' : 'not-allowed',
                    background: (fAmount && fCat) ? 'linear-gradient(135deg, #00C896, #00D4C8)' : 'rgba(0,200,150,0.2)',
                    color: (fAmount && fCat) ? '#001A10' : 'rgba(0,200,150,0.4)',
                    transition: 'all .15s',
                  }}
                >
                  {saving ? 'A guardar…' : 'Guardar transação'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  return (
    <main style={{paddingBottom:100,minHeight:'100vh',background:'#07070F',fontFamily:'Inter, sans-serif'}}>

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

      {/* Header */}
      <div style={{padding:'28px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1 style={{fontFamily:'Inter, sans-serif',fontWeight:800,fontSize:28,marginBottom:3,color:'#fff',letterSpacing:'-0.5px'}}>Finanças</h1>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{format(new Date(),'MMMM yyyy',{locale:pt})}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>csvRef.current?.click()} style={{background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'9px 12px',fontFamily:'Inter, sans-serif',fontWeight:600,fontSize:12,cursor:'pointer'}}>↑ CSV</button>
          <button
            onClick={() => pdfRef.current?.click()}
            disabled={pdfLoading}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer' }}
          >
            {pdfLoading ? 'A ler...' : '📄 Importar PDF'}
          </button>
          <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={importCSV}/>
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={importPDF} />
          <button onClick={()=>setShowForm(true)} style={{background:'#F5C842',color:'#07070F',border:'none',borderRadius:12,padding:'9px 16px',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>+ Registar</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:'rgba(255,255,255,0.05)',borderRadius:14,padding:4,gap:3,margin:'14px 20px 0',border:'1px solid rgba(255,255,255,0.07)'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:'8px 3px',borderRadius:10,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:tab===t.key?'rgba(255,255,255,0.08)':'transparent',color:tab===t.key?'#F5C842':'rgba(255,255,255,0.35)',fontSize:9,fontFamily:'Inter, sans-serif',fontWeight:tab===t.key?600:400,transition:'all .15s'}}>
            <span style={{fontSize:15}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>


      {/* ── TAB MOVIMENTOS ── */}
      {tab==='transacoes'&&(
        <div style={{padding:'14px 20px 0'}}>
          {txs.length===0&&(
            <div style={{textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.4)'}}>
              <div style={{fontSize:40,marginBottom:12}}>💸</div>
              <div style={{fontSize:14,marginBottom:6}}>Sem transações ainda.</div>
              <div style={{fontSize:12}}>Clica em + Registar ou importa um CSV.</div>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {txs.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:13,background:'rgba(255,255,255,0.04)',border:`1px solid ${t.type==='entrada'?'rgba(30,203,180,.15)':'rgba(226,75,74,.1)'}`}}>
                <div style={{width:38,height:38,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,background:t.type==='entrada'?'rgba(30,203,180,.1)':'rgba(226,75,74,.1)'}}>
                  {t.type==='entrada'?'↓':'↑'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:500,color:'#fff',marginBottom:2}}>{t.category}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{t.description&&`${t.description} · `}{format(new Date(t.date+'T12:00:00'),'d MMM',{locale:pt})}</div>
                </div>
                <div style={{fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:15,color:t.type==='entrada'?'#00C896':'#E24B4A',flexShrink:0}}>
                  {t.type==='entrada'?'+':'-'}{fmt(t.amount)}
                </div>
                <button onClick={()=>removeTx(t.id)} style={{width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:14,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
          <div style={{margin:'16px 0',padding:'12px 14px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',fontSize:12,color:'rgba(255,255,255,0.4)',lineHeight:1.6}}>
            <strong style={{color:'rgba(255,255,255,0.6)'}}>Formato CSV:</strong> cabeçalho{' '}
            <code style={{background:'rgba(255,255,255,0.08)',padding:'1px 5px',borderRadius:4}}>data,tipo,categoria,valor,descricao</code>
            . Tipo: &quot;entrada&quot; ou &quot;saida&quot;.
          </div>
        </div>
      )}

      {/* ── TAB ORÇAMENTO ── */}
      {tab==='orcamento'&&(
        <div style={{padding:'14px 20px 0'}}>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:12}}>Toca no valor para editar. Orçamentos guardados localmente.</div>
          {CATEGORIES_OUT.map((cat,ci)=>{
            const spent  = thisMonth.filter(t=>t.type==='saida'&&t.category===cat).reduce((a,t)=>a+t.amount,0)
            const budget = budgets[cat]??0
            const pct    = budget>0 ? Math.min(100,Math.round(spent/budget*100)) : 0
            const over   = spent>budget&&budget>0
            const isEdit = editBudget===cat
            return (
              <div key={cat} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${over?'rgba(226,75,74,.25)':'rgba(255,255,255,0.07)'}`,borderRadius:14,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:CAT_COLORS[ci%CAT_COLORS.length]}}/>
                    <span style={{fontSize:14,color:'#fff',fontWeight:500}}>{cat}</span>
                    {over&&<span style={{fontSize:10,color:'#E24B4A',background:'rgba(226,75,74,.1)',padding:'2px 7px',borderRadius:6}}>acima</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:13,color:over?'#E24B4A':'rgba(255,255,255,0.7)',fontFamily:'Inter, sans-serif',fontWeight:600}}>{fmt(spent)}</span>
                    {isEdit ? (
                      <div style={{display:'flex',gap:5}}>
                        <input autoFocus type="number" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)}
                          style={{width:70,padding:'4px 8px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',color:'#fff',fontSize:13,outline:'none',fontFamily:'Inter, sans-serif'}}
                          onKeyDown={e=>{if(e.key==='Enter')saveBudget(cat,budgetVal);if(e.key==='Escape')setEditBudget(null)}}/>
                        <button onClick={()=>saveBudget(cat,budgetVal)} style={{padding:'4px 8px',borderRadius:8,background:'#F5C842',border:'none',cursor:'pointer',fontSize:12,color:'#07070F',fontWeight:600}}>✓</button>
                      </div>
                    ):(
                      <span onClick={()=>{setEditBudget(cat);setBudgetVal(String(budget))}} style={{fontSize:13,color:'rgba(255,255,255,0.35)',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted'}}>{fmt(budget)}</span>
                    )}
                  </div>
                </div>
                <div style={{background:'rgba(255,255,255,0.08)',borderRadius:100,height:5}}>
                  <div style={{height:'100%',borderRadius:100,background:over?'#E24B4A':pct>80?'#F5C842':CAT_COLORS[ci%CAT_COLORS.length],width:`${pct}%`,transition:'width .4s'}}/>
                </div>
                {budget>0&&<div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:4,textAlign:'right'}}>{pct}% · {fmt(Math.max(0,budget-spent))} restantes</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB METAS ── */}
      {tab==='metas'&&(
        <div style={{padding:'14px 20px 0'}}>
          {[
            {label:'Meta de poupança mensal',icon:'💰',goal:savingsGoal,current:Math.max(0,balance),color:'#00C896',desc:'Quanto quero poupar por mês'},
            {label:'Reserva de emergência',  icon:'🛡️',goal:reserveGoal,current:currentSavings,     color:'#9D5CF5',desc:'Fundo de emergência (3–6× despesas)'},
          ].map(({label,icon,goal,current,color,desc})=>{
            const pct=goal>0?Math.min(100,Math.round(current/goal*100)):0
            const done=goal>0&&current>=goal
            return (
              <div key={label} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${done?'rgba(0,200,150,.25)':'rgba(255,255,255,0.07)'}`,borderRadius:16,padding:'16px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22}}>{icon}</span>
                    <div>
                      <div style={{fontFamily:'Inter, sans-serif',fontWeight:600,fontSize:14,color:'#fff',marginBottom:2}}>{label}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{desc}</div>
                    </div>
                  </div>
                  {done&&<span style={{fontSize:11,color:'#00C896',background:'rgba(0,200,150,.1)',padding:'3px 9px',borderRadius:8}}>✓ Atingida</span>}
                </div>
                {goal>0?(
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:8}}>
                      <span style={{color:'rgba(255,255,255,0.7)'}}>{fmt(current)}</span>
                      <span style={{color,fontFamily:'Inter, sans-serif',fontWeight:600}}>{fmt(goal)}</span>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.08)',borderRadius:100,height:8}}>
                      <div style={{height:'100%',borderRadius:100,background:done?'#00C896':color,width:`${pct}%`,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:5}}>
                      <span>{pct}% atingido</span>
                      <span>{goal>current?`faltam ${fmt(goal-current)}`:'meta atingida 🎉'}</span>
                    </div>
                  </>
                ):(
                  <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',textAlign:'center',padding:'8px 0'}}>Meta não definida — clica em &quot;Editar metas&quot;</div>
                )}
              </div>
            )
          })}

          {/* Histórico poupança */}
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'13px 16px',marginBottom:14}}>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:8}}>Poupança mensal — histórico</div>
            <div style={{height:110,overflow:'hidden'}}>
              {ready&&(
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={monthlyChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                    <XAxis dataKey="label" tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                    <Bar dataKey="poupanca" radius={[5,5,0,0]}>
                      {monthlyChart.map((m,i)=><Cell key={i} fill={m.poupanca>=0?'#00C896':'#E24B4A'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <button onClick={()=>{setGSave(savingsGoal?String(savingsGoal):'');setGReserve(reserveGoal?String(reserveGoal):'');setGCurrent(currentSavings?String(currentSavings):'');setShowGoals(true)}}
            style={{width:'100%',padding:'13px',border:'1px solid rgba(157,92,245,.3)',borderRadius:14,background:'rgba(157,92,245,.08)',color:'#9D5CF5',fontFamily:'Inter, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
            ✏️ Editar metas
          </button>
        </div>
      )}

      {showForm&&(
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',display:'flex',flexDirection:'column',maxHeight:'90vh'}}>
            <div style={{padding:'24px 24px 16px',overflowY:'auto',flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>Nova transação</h2>
                <button onClick={()=>setShowForm(false)} style={{width:30,height:30,borderRadius:9,background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>×</button>
              </div>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {(['entrada','saida'] as const).map(t=>(
                  <button key={t} onClick={()=>{setTxType(t);setFCat('')}} style={{flex:1,padding:'11px',borderRadius:12,border:'none',cursor:'pointer',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,background:txType===t?(t==='entrada'?'var(--teal)':'#E24B4A'):'var(--bg2)',color:txType===t?'var(--bg0)':'var(--text2)',transition:'all .15s'}}>
                    {t==='entrada'?'↓ Entrada':'↑ Saída'}
                  </button>
                ))}
              </div>
              <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Valor (€)</label>
              <input type="number" step="0.01" value={fAmount} onChange={e=>setFAmount(e.target.value)} placeholder="0.00" style={{...inp,marginBottom:12,fontSize:18,fontFamily:'Syne, sans-serif',fontWeight:600}}/>
              <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Categoria</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                {(txType==='entrada'?CATEGORIES_IN:CATEGORIES_OUT).map(cat=>(
                  <button key={cat} onClick={()=>setFCat(cat)} style={{padding:'7px 12px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontFamily:'DM Sans, sans-serif',background:fCat===cat?(txType==='entrada'?'var(--teal)':'#E24B4A'):'var(--bg2)',color:fCat===cat?'var(--bg0)':'var(--text2)',outline:fCat===cat?'none':'0.5px solid var(--border)',transition:'all .15s'}}>{cat}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
                <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Descrição</label><input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Opcional" style={inp}/></div>
                <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Data</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={inp}/></div>
              </div>
            </div>
            {/* Botão sticky — zIndex 9999 garante que fica acima do Nav */}
            <div style={{padding:'12px 24px 48px',background:'var(--bg1)',borderTop:'0.5px solid var(--border)'}}>
              <button onClick={addTx} disabled={saving||!fAmount||!fCat} style={{width:'100%',border:'none',borderRadius:14,padding:15,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,cursor:(fAmount&&fCat)?'pointer':'not-allowed',background:(fAmount&&fCat)?'var(--gold)':'rgba(232,168,56,0.25)',color:(fAmount&&fCat)?'var(--bg0)':'rgba(232,168,56,0.6)',transition:'all .15s'}}>
                {saving?'A guardar…':'Guardar transação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Metas */}
      {showGoals&&(
        <div style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowGoals(false)}>
          <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>Metas financeiras</h2>
              <button onClick={()=>setShowGoals(false)} style={{width:30,height:30,borderRadius:9,background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>×</button>
            </div>
            {[
              {l:'Meta poupança mensal (€)',v:gSave,s:setGSave,ph:'Ex: 300'},
              {l:'Objetivo de reserva de emergência (€)',v:gReserve,s:setGReserve,ph:'Ex: 5000'},
              {l:'Poupança atual acumulada (€)',v:gCurrent,s:setGCurrent,ph:'Ex: 1200'},
            ].map(({l,v,s,ph})=>(
              <div key={l} style={{marginBottom:14}}>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>{l}</label>
                <input type="number" step="0.01" value={v} onChange={e=>s(e.target.value)} placeholder={ph} style={inp}/>
              </div>
            ))}
            <button onClick={saveGoals} disabled={gSaving} style={{width:'100%',background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:14,padding:14,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
              {gSaving?'A guardar…':'Guardar metas'}
            </button>
          </div>
        </div>
      )}

      <Nav/>
    </main>
  )
}
