'use client'
// src/app/financas/page.tsx
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import Nav from '@/components/Nav'
import {
  supabase, getProfile, getTransactions,
  getTransactionsByMonth, saveTransaction,
  deleteTransaction, updateFinancialGoals,
} from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile, Transaction } from '@/types'

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
const TT: React.CSSProperties = {
  background:'#1C2030', border:'0.5px solid rgba(255,255,255,.1)', borderRadius:10, color:'#F0EDE8', fontSize:12,
}

export default function FinancasPage() {
  const [profile,    setProfile]   = useState<Profile|null>(null)
  const [txs,        setTxs]       = useState<Transaction[]>([])
  const [history,    setHistory]   = useState<Transaction[]>([])
  const [userId,     setUserId]    = useState<string|null>(null)
  const [tab,        setTab]       = useState<AppTab>('resumo')
  const [loading,    setLoading]   = useState(true)
  const [ready,      setReady]     = useState(false)
  const [toast,      setToast]     = useState('')
  const [budgets,    setBudgets]   = useState<Record<string,number>>(DEFAULT_BUDGETS)
  // Form transacção
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

  const fmt = (v:number) => v.toLocaleString('pt-PT',{style:'currency',currency:'EUR'})
  function showToast(m:string) { setToast(m); setTimeout(()=>setToast(''),2400) }

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

  // Métricas mês actual
  const monthStart = format(startOfMonth(new Date()),'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),'yyyy-MM-dd')
  const thisMonth  = useMemo(()=>txs.filter(t=>t.date>=monthStart&&t.date<=monthEnd),[txs,monthStart,monthEnd])
  const totalIn    = useMemo(()=>thisMonth.filter(t=>t.type==='entrada').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const totalOut   = useMemo(()=>thisMonth.filter(t=>t.type==='saida').reduce((a,t)=>a+t.amount,0),[thisMonth])
  const balance    = totalIn - totalOut
  const savedPct   = totalIn>0 ? Math.round(balance/totalIn*100) : 0

  // Previsão — só projectar com dados suficientes (mínimo 3 dias)
  const dayOfMonth   = getDate(new Date())
  const daysInMonth  = getDaysInMonth(new Date())
  const daysLeft     = daysInMonth - dayOfMonth
  const hasEnoughData = dayOfMonth >= 3
  const dailyBurn    = hasEnoughData ? totalOut / dayOfMonth : 0
  const projectedOut = hasEnoughData ? Math.round(dailyBurn * daysInMonth) : 0
  const projectedBal = hasEnoughData ? totalIn - projectedOut : 0

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
    if (error) { showToast('Erro ao guardar.'); setSaving(false); return }
    const [r,h] = await Promise.all([getTransactions(userId,2),getTransactionsByMonth(userId,6)])
    setTxs(r as Transaction[]); setHistory(h as Transaction[])
    setFAmount(''); setFDesc(''); setFCat(''); setShowForm(false)
    showToast('Transacção adicionada!'); setSaving(false)
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
    setShowGoals(false); showToast('Metas actualizadas!'); setGSaving(false)
  }

  function saveBudget(cat:string,val:string) {
    const n=parseFloat(val); if (isNaN(n)||n<0) return
    const updated={...budgets,[cat]:n}
    setBudgets(updated)
    if (userId) try { localStorage.setItem(`nexus_budgets_${userId}`,JSON.stringify(updated)) } catch {}
    setEditBudget(null); showToast('Orçamento guardado.')
  }

  function importCSV(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if (!file||!userId) return
    const reader=new FileReader()
    reader.onload=async(ev)=>{
      const lines=(ev.target?.result as string).split('\n').filter(l=>l.trim())
      let imported=0
      for (const line of lines.slice(1)) {
        const [date,type,category,amount,description]=line.split(',').map(c=>c.replace(/"/g,'').trim())
        if (!date||!type||!category||!amount) continue
        await saveTransaction({user_id:userId,date,type:type.toLowerCase().includes('entrada')?'entrada':'saida',category,amount:parseFloat(amount.replace(',','.')),description:description??null})
        imported++
      }
      const [r,h]=await Promise.all([getTransactions(userId,2),getTransactionsByMonth(userId,6)])
      setTxs(r as Transaction[]); setHistory(h as Transaction[])
      showToast(`${imported} transacções importadas!`)
    }
    reader.readAsText(file); e.target.value=''
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

  return (
    <main style={{paddingBottom:100,minHeight:'100vh'}}>

      {toast&&<div style={{position:'fixed',bottom:88,left:'50%',transform:'translateX(-50%)',background:'var(--bg2)',border:'0.5px solid rgba(30,203,180,.38)',borderRadius:12,padding:'10px 18px',fontSize:13,color:'var(--teal)',zIndex:200,whiteSpace:'nowrap'}}>✓ {toast}</div>}

      {/* Header */}
      <div style={{padding:'28px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,marginBottom:3}}>Finanças</h1>
          <p style={{fontSize:12,color:'var(--text3)'}}>{format(new Date(),'MMMM yyyy',{locale:pt})}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>csvRef.current?.click()} style={{background:'var(--bg2)',color:'var(--text2)',border:'0.5px solid var(--border)',borderRadius:12,padding:'9px 12px',fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:12,cursor:'pointer'}}>↑ CSV</button>
          <input ref={csvRef} type="file" accept=".csv" style={{display:'none'}} onChange={importCSV}/>
          <button onClick={()=>setShowForm(true)} style={{background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:12,padding:'9px 16px',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,cursor:'pointer'}}>+ Registar</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:'var(--bg2)',borderRadius:14,padding:4,gap:3,margin:'14px 20px 0',border:'0.5px solid var(--border)'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:'8px 3px',borderRadius:10,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:tab===t.key?'var(--bg1)':'transparent',color:tab===t.key?'var(--gold)':'var(--text3)',fontSize:9,fontFamily:'Syne, sans-serif',fontWeight:tab===t.key?600:400,transition:'all .15s'}}>
            <span style={{fontSize:15}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB RESUMO ── */}
      {tab==='resumo'&&(
        <div style={{padding:'14px 20px 0'}}>
          {/* Métricas */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {[
              {l:'Entradas',v:fmt(totalIn),c:'var(--teal)',b:'rgba(30,203,180,.2)'},
              {l:'Saídas',v:fmt(totalOut),c:'#E24B4A',b:'rgba(226,75,74,.2)'},
              {l:'Saldo',v:fmt(balance),c:balance>=0?'var(--gold)':'#E24B4A',b:balance>=0?'rgba(232,168,56,.2)':'rgba(226,75,74,.2)'},
              {l:'Taxa poupança',v:`${savedPct}%`,c:savedPct>=20?'var(--teal)':savedPct>=10?'var(--gold)':'var(--text2)',b:'var(--border)'},
            ].map(({l,v,c,b})=>(
              <div key={l} style={{background:'var(--bg2)',border:`0.5px solid ${b}`,borderRadius:14,padding:14}}>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{l}</div>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:19,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Previsão */}
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:'13px 16px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:12,color:'var(--text3)'}}>Previsão fim de mês</span>
              <span style={{fontSize:11,color:'var(--text3)'}}>dia {dayOfMonth}/{daysInMonth}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[
                {l:'Saídas previstas',v:fmt(projectedOut),c:'#E24B4A'},
                {l:'Saldo previsto',v:fmt(projectedBal),c:projectedBal>=0?'var(--gold)':'#E24B4A'},
                {l:'Ritmo/dia',v:fmt(Math.round(dailyBurn)),c:'var(--text2)'},
              ].map(({l,v,c})=>(
                <div key={l} style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,color:c,marginBottom:2}}>{v}</div>
                  <div style={{fontSize:10,color:'var(--text3)',lineHeight:1.3}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Evolução 6 meses */}
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'13px 16px',marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Evolução — últimos 6 meses</div>
            <div style={{display:'flex',gap:14,marginBottom:8}}>
              {[['var(--teal)','Entradas'],['#E24B4A','Saídas'],['var(--gold)','Poupança']].map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
                  <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
                </div>
              ))}
            </div>
            <div style={{height:140,overflow:'hidden'}}>
              {ready&&(
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={monthlyChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                    <XAxis dataKey="label" tick={{fill:'#5A6070',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                    <Line type="monotone" dataKey="entradas" stroke="var(--teal)"   strokeWidth={2} dot={{r:3,fill:'var(--teal)'}} connectNulls/>
                    <Line type="monotone" dataKey="saidas"   stroke="#E24B4A"        strokeWidth={2} dot={{r:3,fill:'#E24B4A'}} connectNulls/>
                    <Line type="monotone" dataKey="poupanca" stroke="var(--gold)"   strokeWidth={2} dot={{r:3,fill:'var(--gold)'}} strokeDasharray="4 2" connectNulls/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Por categoria */}
          {byCategory.length>0&&(
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'13px 16px'}}>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Saídas por categoria</div>
              <div style={{height:Math.min(200,byCategory.length*34),overflow:'hidden'}}>
                {ready&&(
                  <ResponsiveContainer width="100%" height={Math.min(200,byCategory.length*34)}>
                    <BarChart data={byCategory} layout="vertical" margin={{left:0,right:40}}>
                      <XAxis type="number" hide/>
                      <YAxis type="category" dataKey="name" tick={{fill:'#9BA0B0',fontSize:11}} width={90} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                      <Bar dataKey="value" radius={[0,5,5,0]}>
                        {byCategory.map((_,i)=><Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB MOVIMENTOS ── */}
      {tab==='transacoes'&&(
        <div style={{padding:'14px 20px 0'}}>
          {txs.length===0&&(
            <div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
              <div style={{fontSize:40,marginBottom:12}}>💸</div>
              <div style={{fontSize:14,marginBottom:6}}>Sem transacções ainda.</div>
              <div style={{fontSize:12}}>Clica em + Registar ou importa um CSV.</div>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {txs.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:13,background:'var(--bg2)',border:`0.5px solid ${t.type==='entrada'?'rgba(30,203,180,.15)':'rgba(226,75,74,.1)'}`}}>
                <div style={{width:38,height:38,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,background:t.type==='entrada'?'rgba(30,203,180,.1)':'rgba(226,75,74,.1)'}}>
                  {t.type==='entrada'?'↓':'↑'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:500,color:'var(--text1)',marginBottom:2}}>{t.category}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{t.description&&`${t.description} · `}{format(new Date(t.date+'T12:00:00'),'d MMM',{locale:pt})}</div>
                </div>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,color:t.type==='entrada'?'var(--teal)':'#E24B4A',flexShrink:0}}>
                  {t.type==='entrada'?'+':'-'}{fmt(t.amount)}
                </div>
                <button onClick={()=>removeTx(t.id)} style={{width:26,height:26,borderRadius:8,background:'var(--bg3)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
          <div style={{margin:'16px 0',padding:'12px 14px',borderRadius:12,background:'var(--bg2)',border:'0.5px solid var(--border)',fontSize:12,color:'var(--text3)',lineHeight:1.6}}>
            <strong style={{color:'var(--text2)'}}>Formato CSV:</strong> cabeçalho{' '}
            <code style={{background:'var(--bg3)',padding:'1px 5px',borderRadius:4}}>data,tipo,categoria,valor,descricao</code>
            . Tipo: "entrada" ou "saida".
          </div>
        </div>
      )}

      {/* ── TAB ORÇAMENTO ── */}
      {tab==='orcamento'&&(
        <div style={{padding:'14px 20px 0'}}>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>Toca no valor para editar. Orçamentos guardados localmente.</div>
          {CATEGORIES_OUT.map((cat,ci)=>{
            const spent  = thisMonth.filter(t=>t.type==='saida'&&t.category===cat).reduce((a,t)=>a+t.amount,0)
            const budget = budgets[cat]??0
            const pct    = budget>0 ? Math.min(100,Math.round(spent/budget*100)) : 0
            const over   = spent>budget&&budget>0
            const isEdit = editBudget===cat
            return (
              <div key={cat} style={{background:'var(--bg2)',border:`0.5px solid ${over?'rgba(226,75,74,.25)':'var(--border)'}`,borderRadius:14,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:CAT_COLORS[ci%CAT_COLORS.length]}}/>
                    <span style={{fontSize:14,color:'var(--text1)',fontWeight:500}}>{cat}</span>
                    {over&&<span style={{fontSize:10,color:'#E24B4A',background:'rgba(226,75,74,.1)',padding:'2px 7px',borderRadius:6}}>acima</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:13,color:over?'#E24B4A':'var(--text2)',fontFamily:'Syne, sans-serif',fontWeight:600}}>{fmt(spent)}</span>
                    {isEdit ? (
                      <div style={{display:'flex',gap:5}}>
                        <input autoFocus type="number" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)}
                          style={{width:70,padding:'4px 8px',borderRadius:8,background:'var(--bg3)',border:'0.5px solid var(--border)',color:'var(--text1)',fontSize:13,outline:'none',fontFamily:'DM Sans, sans-serif'}}
                          onKeyDown={e=>{if(e.key==='Enter')saveBudget(cat,budgetVal);if(e.key==='Escape')setEditBudget(null)}}/>
                        <button onClick={()=>saveBudget(cat,budgetVal)} style={{padding:'4px 8px',borderRadius:8,background:'var(--gold)',border:'none',cursor:'pointer',fontSize:12,color:'var(--bg0)',fontWeight:600}}>✓</button>
                      </div>
                    ):(
                      <span onClick={()=>{setEditBudget(cat);setBudgetVal(String(budget))}} style={{fontSize:13,color:'var(--text3)',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted'}}>{fmt(budget)}</span>
                    )}
                  </div>
                </div>
                <div style={{background:'var(--bg3)',borderRadius:100,height:5}}>
                  <div style={{height:'100%',borderRadius:100,background:over?'#E24B4A':pct>80?'var(--gold)':CAT_COLORS[ci%CAT_COLORS.length],width:`${pct}%`,transition:'width .4s'}}/>
                </div>
                {budget>0&&<div style={{fontSize:10,color:'var(--text3)',marginTop:4,textAlign:'right'}}>{pct}% · {fmt(Math.max(0,budget-spent))} restantes</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB METAS ── */}
      {tab==='metas'&&(
        <div style={{padding:'14px 20px 0'}}>
          {[
            {label:'Meta de poupança mensal',icon:'💰',goal:savingsGoal,current:Math.max(0,balance),color:'var(--teal)',desc:'Quanto quero poupar por mês'},
            {label:'Reserva de emergência',  icon:'🛡️',goal:reserveGoal,current:currentSavings,     color:'var(--accent)',desc:'Fundo de emergência (3–6× despesas)'},
          ].map(({label,icon,goal,current,color,desc})=>{
            const pct=goal>0?Math.min(100,Math.round(current/goal*100)):0
            const done=goal>0&&current>=goal
            return (
              <div key={label} style={{background:'var(--bg2)',border:`0.5px solid ${done?'rgba(30,203,180,.25)':'var(--border)'}`,borderRadius:16,padding:'16px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:22}}>{icon}</span>
                    <div>
                      <div style={{fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:14,color:'var(--text1)',marginBottom:2}}>{label}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>{desc}</div>
                    </div>
                  </div>
                  {done&&<span style={{fontSize:11,color:'var(--teal)',background:'rgba(30,203,180,.1)',padding:'3px 9px',borderRadius:8}}>✓ Atingida</span>}
                </div>
                {goal>0?(
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:8}}>
                      <span style={{color:'var(--text2)'}}>{fmt(current)}</span>
                      <span style={{color,fontFamily:'Syne, sans-serif',fontWeight:600}}>{fmt(goal)}</span>
                    </div>
                    <div style={{background:'var(--bg3)',borderRadius:100,height:8}}>
                      <div style={{height:'100%',borderRadius:100,background:done?'var(--teal)':color,width:`${pct}%`,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)',marginTop:5}}>
                      <span>{pct}% atingido</span>
                      <span>{goal>current?`faltam ${fmt(goal-current)}`:'meta atingida 🎉'}</span>
                    </div>
                  </>
                ):(
                  <div style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'8px 0'}}>Meta não definida — clica em "Editar metas"</div>
                )}
              </div>
            )
          })}

          {/* Histórico poupança */}
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:'13px 16px',marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Poupança mensal — histórico</div>
            <div style={{height:110,overflow:'hidden'}}>
              {ready&&(
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={monthlyChart}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)"/>
                    <XAxis dataKey="label" tick={{fill:'#5A6070',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip contentStyle={TT} formatter={(v:number)=>fmt(v)}/>
                    <Bar dataKey="poupanca" radius={[5,5,0,0]}>
                      {monthlyChart.map((m,i)=><Cell key={i} fill={m.poupanca>=0?'var(--teal)':'#E24B4A'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <button onClick={()=>{setGSave(savingsGoal?String(savingsGoal):'');setGReserve(reserveGoal?String(reserveGoal):'');setGCurrent(currentSavings?String(currentSavings):'');setShowGoals(true)}}
            style={{width:'100%',padding:'13px',border:'0.5px solid rgba(127,119,221,.3)',borderRadius:14,background:'rgba(127,119,221,.08)',color:'var(--accent)',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
            ✏️ Editar metas
          </button>
        </div>
      )}

      {/* MODAL: Nova transacção */}
      {showForm&&(
        <div style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>Nova transacção</h2>
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
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
              <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Descrição</label><input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Opcional" style={inp}/></div>
              <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Data</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={inp}/></div>
            </div>
            <button onClick={addTx} disabled={saving||!fAmount||!fCat} style={{width:'100%',border:'none',borderRadius:14,padding:15,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,cursor:(fAmount&&fCat)?'pointer':'not-allowed',background:(fAmount&&fCat)?'var(--gold)':'rgba(232,168,56,0.25)',color:(fAmount&&fCat)?'var(--bg0)':'rgba(232,168,56,0.6)',transition:'all .15s',marginTop:4}}>
              {saving?'A guardar…':'Guardar transacção'}
            </button>
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
              {l:'Objectivo reserva emergência (€)',v:gReserve,s:setGReserve,ph:'Ex: 5000'},
              {l:'Poupança actual acumulada (€)',v:gCurrent,s:setGCurrent,ph:'Ex: 1200'},
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
