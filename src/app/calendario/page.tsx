'use client'
// src/app/calendario/page.tsx — Calendário unificado com 4 abas
import { useEffect, useState, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, subMonths, addMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import {
  supabase, getCalendarData, getCheckinsForDate,
  getReminders, saveReminder, toggleReminder, deleteReminder,
  getAgendaEvents, saveAgendaEvent, deleteAgendaEvent,
} from '@/lib/supabase'
import type { AgendaEvent } from '@/lib/supabase'

type DayStatus = { habits: number; checkins: number; complete: boolean }
type Tab = 'calendario' | 'checkin' | 'lembretes' | 'agenda'
type Reminder = { id: string; title: string; time: string; days: number[]; active: boolean; type: string }
type Checkin = { phase: string; energy?: number; sleep_hours?: number; mood?: number; mission?: string; win_of_day?: string; xp_earned: number }

const DAYS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const PHASE_LABELS: Record<string,string> = { manha:'Manhã', tarde:'Tarde', noite:'Noite' }
const PHASE_EMOJI:  Record<string,string> = { manha:'🌅', tarde:'☀️',  noite:'🌙' }
const EVENT_COLORS = ['#E8A838','#1ECBB4','#7F77DD','#E24B4A','#1D9E75','#D4537E','#85B7EB']

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg2)', border:'0.5px solid var(--border)',
  borderRadius:12, padding:'11px 14px', color:'var(--text1)',
  fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none',
}

export default function CalendarioPage() {
  const [userId,     setUserId]     = useState<string|null>(null)
  const [tab,        setTab]        = useState<Tab>('calendario')
  const [current,    setCurrent]    = useState(new Date())
  const [dayMap,     setDayMap]     = useState<Record<string,DayStatus>>({})
  const [selected,   setSelected]   = useState<string|null>(null)
  const [selCheckins,setSelCheckins]= useState<Checkin[]>([])
  const [selEvents,  setSelEvents]  = useState<AgendaEvent[]>([])
  const [reminders,  setReminders]  = useState<Reminder[]>([])
  const [events,     setEvents]     = useState<AgendaEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [todayCI,    setTodayCI]    = useState<Checkin[]>([])

  // Lembretes form
  const [showRmForm, setShowRmForm] = useState(false)
  const [rmTitle,    setRmTitle]    = useState('')
  const [rmTime,     setRmTime]     = useState('08:00')
  const [rmDays,     setRmDays]     = useState<number[]>([1,2,3,4,5])
  const [rmType,     setRmType]     = useState('custom')
  const [rmSaving,   setRmSaving]   = useState(false)

  // Agenda form
  const [showEvForm, setShowEvForm] = useState(false)
  const [evTitle,    setEvTitle]    = useState('')
  const [evDesc,     setEvDesc]     = useState('')
  const [evDate,     setEvDate]     = useState(format(new Date(),'yyyy-MM-dd'))
  const [evTime,     setEvTime]     = useState('')
  const [evEndTime,  setEvEndTime]  = useState('')
  const [evColor,    setEvColor]    = useState('#E8A838')
  const [evAllDay,   setEvAllDay]   = useState(false)
  const [evSaving,   setEvSaving]   = useState(false)
  const [toast,      setToast]      = useState('')

  const today = format(new Date(),'yyyy-MM-dd')

  function showToast(m: string) { setToast(m); setTimeout(()=>setToast(''),2400) }

  const loadMonth = useCallback(async (uid: string, date: Date) => {
    const [calData, evs] = await Promise.all([
      getCalendarData(uid, date.getFullYear(), date.getMonth()+1),
      getAgendaEvents(uid, date.getFullYear(), date.getMonth()+1),
    ])
    setEvents(evs)
    const map: Record<string,DayStatus> = {}
    ;(calData.logs as {date:string;completed:boolean}[]).forEach(l => {
      if (!map[l.date]) map[l.date] = { habits:0, checkins:0, complete:false }
      if (l.completed) map[l.date].habits++
    })
    ;(calData.checkins as {date:string}[]).forEach(c => {
      if (!map[c.date]) map[c.date] = { habits:0, checkins:0, complete:false }
      map[c.date].checkins++
    })
    Object.values(map).forEach(d => { d.complete = d.checkins >= 2 && d.habits >= 1 })
    setDayMap(map)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      await Promise.all([
        loadMonth(user.id, new Date()),
        getReminders(user.id).then(d => setReminders(d as Reminder[])),
        getCheckinsForDate(user.id, today).then(d => setTodayCI(d as Checkin[])),
      ])
      setLoading(false)
    })
  }, [today, loadMonth])

  async function changeMonth(dir: 1|-1) {
    const next = dir===1 ? addMonths(current,1) : subMonths(current,1)
    setCurrent(next)
    if (userId) await loadMonth(userId, next)
  }

  async function selectDay(dateStr: string) {
    if (selected === dateStr) { setSelected(null); return }
    setSelected(dateStr)
    if (!userId) return
    const [ci, evRes] = await Promise.all([
      getCheckinsForDate(userId, dateStr),
      supabase.from('agenda_events').select('*').eq('user_id',userId).eq('date',dateStr).order('time'),
    ])
    setSelCheckins(ci as Checkin[])
    setSelEvents((evRes.data ?? []) as AgendaEvent[])
  }

  async function saveRm() {
    if (!userId || !rmTitle.trim()) return
    setRmSaving(true)
    await saveReminder({ user_id:userId, title:rmTitle, time:rmTime, days:rmDays, type:rmType, active:true })
    setReminders(await getReminders(userId) as Reminder[])
    setShowRmForm(false); setRmTitle(''); setRmDays([1,2,3,4,5])
    showToast('Lembrete criado!')
    setRmSaving(false)
  }


  async function toggleRm(id: string, active: boolean) {
    if (!userId) return
    await toggleReminder(id, !active)
    setReminders(await getReminders(userId) as Reminder[])
    showToast(!active ? 'Lembrete ativado!' : 'Lembrete desativado!')
  }

  async function removeRm(id: string) {
    if (!userId) return
    await deleteReminder(id)
    setReminders(prev => prev.filter(r => r.id !== id))
    showToast('Lembrete removido!')
  }

  async function saveEv() {
    if (!userId || !evTitle.trim()) return
    setEvSaving(true)
    await saveAgendaEvent({ user_id:userId, title:evTitle, description:evDesc||null, date:evDate, time:evTime||null, end_time:evEndTime||null, color:evColor, all_day:evAllDay })
    await loadMonth(userId, current)
    setShowEvForm(false); setEvTitle(''); setEvDesc(''); setEvTime(''); setEvEndTime('')
    showToast('Evento adicionado!')
    setEvSaving(false)
  }

  const days      = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) })
  const startPad  = getDay(startOfMonth(current))
  const doneDays  = Object.values(dayMap).filter(d=>d.complete).length

  function dayBg(dateStr: string) {
    const s = dayMap[dateStr]
    if (!s) return 'transparent'
    if (s.complete) return 'var(--teal)'
    if (s.checkins>=1) return 'rgba(127,119,221,.4)'
    if (s.habits>=1)   return 'rgba(232,168,56,.3)'
    return 'transparent'
  }

  const TABS: {key:Tab;label:string;icon:string}[] = [
    {key:'calendario',label:'Calendário',icon:'📅'},
    {key:'checkin',   label:'Check-in',  icon:'✅'},
    {key:'lembretes', label:'Alertas',   icon:'🔔'},
    {key:'agenda',    label:'Agenda',    icon:'📋'},
  ]

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <div style={{fontFamily:'Syne, sans-serif',color:'var(--text3)'}}>a carregar…</div>
    </div>
  )

  return (
    <main style={{paddingBottom:100,minHeight:'100vh'}}>

      {toast && (
        <div style={{position:'fixed',bottom:88,left:'50%',transform:'translateX(-50%)',background:'var(--bg2)',border:'0.5px solid rgba(30,203,180,.38)',borderRadius:12,padding:'10px 18px',fontSize:13,color:'var(--teal)',zIndex:200,whiteSpace:'nowrap'}}>
          ✓ {toast}
        </div>
      )}

      <div style={{padding:'28px 20px 0'}}>
        <h1 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,marginBottom:16}}>Calendário</h1>
        <div style={{display:'flex',background:'var(--bg2)',borderRadius:14,padding:4,gap:3,border:'0.5px solid var(--border)'}}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              flex:1,padding:'8px 3px',borderRadius:10,border:'none',cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              background:tab===t.key?'var(--bg1)':'transparent',
              color:tab===t.key?'var(--gold)':'var(--text3)',
              transition:'all .15s',fontSize:9,fontFamily:'Syne, sans-serif',fontWeight:tab===t.key?600:400,
            }}>
              <span style={{fontSize:16}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CALENDÁRIO ─── */}
      {tab==='calendario' && (
        <div style={{padding:'14px 20px 0'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
            {[
              {label:'Completos',value:doneDays,color:'var(--teal)',icon:'✓'},
              {label:'Parciais', value:Object.values(dayMap).filter(d=>!d.complete&&(d.checkins>0||d.habits>0)).length,color:'var(--accent)',icon:'◐'},
              {label:'% do mês', value:days.length>0?Math.round(doneDays/days.length*100)+'%':'0%',color:'var(--gold)',icon:''},
            ].map(({label,value,color})=>(
              <div key={label} style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,color,lineHeight:1}}>{value}</div>
                <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Card do calendário */}
          <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:20,padding:'16px',marginBottom:14}}>
            {/* Navegação mês */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <button onClick={()=>changeMonth(-1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
              <span style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:16,color:'var(--text1)'}}>{format(current,'MMMM yyyy',{locale:pt})}</span>
              <button onClick={()=>changeMonth(1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            </div>

            {/* Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:6}}>
              {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'var(--text3)',paddingBottom:6,fontWeight:600,letterSpacing:'.02em'}}>{d}</div>)}
              {Array.from({length:startPad}).map((_,i)=><div key={`p${i}`}/>)}
              {days.map(day=>{
                const dateStr=format(day,'yyyy-MM-dd')
                const isT=isToday(day)
                const isSel=selected===dateStr
                const hasEv=events.some(e=>e.date===dateStr)
                const future=day>new Date()
                const status=dayMap[dateStr]
                return (
                  <button key={dateStr} onClick={()=>selectDay(dateStr)} style={{
                    aspectRatio:'1',borderRadius:10,border:'none',cursor:'pointer',
                    background:isSel?'rgba(127,119,221,.25)':dayBg(dateStr),
                    outline:isT?'2px solid var(--gold)':'none',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
                    opacity:future?0.25:1,transition:'all .15s',
                  }}>
                    <span style={{fontFamily:'Syne, sans-serif',fontWeight:isT?700:500,fontSize:14,color:status?.complete?'var(--bg0)':isT?'var(--gold)':isSel?'var(--accent)':'var(--text2)',lineHeight:1}}>
                      {format(day,'d')}
                    </span>
                    {(status?.checkins>0||status?.habits>0||hasEv)&&(
                      <div style={{display:'flex',gap:2}}>
                        {status?.checkins>0&&<div style={{width:3,height:3,borderRadius:'50%',background:status.complete?'var(--bg0)':'var(--accent)'}}/>}
                        {status?.habits>0&&<div style={{width:3,height:3,borderRadius:'50%',background:status.complete?'var(--bg0)':'var(--gold)'}}/>}
                        {hasEv&&<div style={{width:3,height:3,borderRadius:'50%',background:status?.complete?'var(--bg0)':'var(--teal)'}}/>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legenda */}
            <div style={{display:'flex',gap:10,flexWrap:'wrap',paddingTop:10,borderTop:'0.5px solid var(--border)'}}>
              {([['var(--teal)','Dia completo'],['rgba(127,119,221,.6)','Check-in'],['rgba(232,168,56,.5)','Hábito'],['var(--teal)','Evento']] as [string,string][]).map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>{l}
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div style={{background:'var(--bg2)',border:'0.5px solid rgba(127,119,221,.22)',borderRadius:16,padding:16}}>
              <div style={{fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:15,marginBottom:12}}>
                {format(new Date(selected+'T12:00:00'),"EEEE, d 'de' MMMM",{locale:pt})}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                {[
                  {l:'Hábitos', v:dayMap[selected]?.habits??0,    c:'var(--gold)'},
                  {l:'Check-ins',v:dayMap[selected]?.checkins??0, c:'var(--accent)'},
                  {l:'Eventos', v:selEvents.length,               c:'var(--teal)'},
                ].map(({l,v,c})=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:'var(--text3)'}}>{l}</div>
                  </div>
                ))}
              </div>
              {selCheckins.map((ci,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:8,padding:'10px 12px',borderRadius:10,background:'var(--bg3)'}}>
                  <span style={{fontSize:16,flexShrink:0}}>{PHASE_EMOJI[ci.phase]??'⏰'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'var(--text1)',fontWeight:500}}>{PHASE_LABELS[ci.phase]??ci.phase}</div>
                    {ci.energy&&<div style={{fontSize:11,color:'var(--text3)'}}>Energia {ci.energy}/10{ci.sleep_hours?` · Sono ${ci.sleep_hours}h`:''}</div>}
                    {ci.mission&&ci.phase==='manha'&&<div style={{fontSize:11,color:'var(--text2)',fontStyle:'italic',marginTop:2}}>"{ci.mission}"</div>}
                    {ci.win_of_day&&<div style={{fontSize:11,color:'var(--teal)',marginTop:2}}>🏆 {ci.win_of_day}</div>}
                  </div>
                  <div style={{fontSize:11,color:'var(--gold)',fontFamily:'Syne, sans-serif',fontWeight:600}}>+{ci.xp_earned} XP</div>
                </div>
              ))}
              {selEvents.map(ev=>(
                <div key={ev.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,padding:'10px 12px',borderRadius:10,background:'var(--bg3)'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:ev.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'var(--text1)',fontWeight:500}}>{ev.title}</div>
                    {ev.time&&<div style={{fontSize:11,color:'var(--text3)'}}>{ev.time.slice(0,5)}{ev.end_time?` – ${ev.end_time.slice(0,5)}`:''}</div>}
                  </div>
                  <button onClick={()=>{deleteAgendaEvent(ev.id);setSelEvents(e=>e.filter(x=>x.id!==ev.id))}} style={{width:24,height:24,borderRadius:7,background:'var(--bg2)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>×</button>
                </div>
              ))}
              <button onClick={()=>{setEvDate(selected);setShowEvForm(true);setTab('agenda')}} style={{width:'100%',padding:'9px',border:'0.5px solid rgba(30,203,180,.28)',borderRadius:10,background:'rgba(30,203,180,.06)',color:'var(--teal)',cursor:'pointer',fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:12}}>+ Evento neste dia</button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB CHECK-IN ─── */}
      {tab==='checkin' && (
        <div style={{padding:'14px 20px 0'}}>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>{format(new Date(),"EEEE, d 'de' MMMM",{locale:pt})}</div>
          {(['manha','tarde','noite'] as const).map(phase=>{
            const ci=todayCI.find(c=>c.phase===phase)
            return (
              <div key={phase} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,marginBottom:8,background:ci?'rgba(30,203,180,.05)':'var(--bg2)',border:ci?'0.5px solid rgba(30,203,180,.22)':'0.5px solid var(--border)'}}>
                <span style={{fontSize:22,flexShrink:0}}>{PHASE_EMOJI[phase]}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:14,color:ci?'var(--text1)':'var(--text3)',marginBottom:ci?4:0}}>Check-in da {PHASE_LABELS[phase]}</div>
                  {ci?(
                    <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>
                      {ci.energy&&`Energia ${ci.energy}/10`}{ci.sleep_hours&&` · Sono ${ci.sleep_hours}h`}
                      {ci.mission&&phase==='manha'&&<div style={{fontStyle:'italic',color:'var(--text3)'}}>"{ci.mission}"</div>}
                      {ci.win_of_day&&<div style={{color:'var(--teal)'}}>🏆 {ci.win_of_day}</div>}
                    </div>
                  ):<div style={{fontSize:12,color:'var(--text3)'}}>Por fazer</div>}
                </div>
                {ci
                  ?<div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,color:'var(--teal)'}}>+{ci.xp_earned} XP ✓</div>
                  :<a href="/checkin" style={{padding:'7px 12px',borderRadius:9,background:'var(--gold)',color:'var(--bg0)',textDecoration:'none',fontSize:12,fontFamily:'Syne, sans-serif',fontWeight:700,flexShrink:0}}>Fazer</a>
                }
              </div>
            )
          })}
        </div>
      )}

      {/* ─── TAB LEMBRETES ─── */}
      {tab==='lembretes' && (
        <div style={{padding:'14px 20px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text3)'}}>{reminders.filter(r=>r.active).length} activos</div>
            <button onClick={()=>setShowRmForm(true)} style={{background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:10,padding:'8px 14px',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Novo</button>
          </div>
          {reminders.length===0&&<div style={{textAlign:'center',padding:'32px 0',color:'var(--text3)',fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>🔔</div>Sem lembretes ainda.</div>}
          {reminders.map(r=>(
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'13px 14px',borderRadius:14,marginBottom:8,background:'var(--bg2)',border:'0.5px solid var(--border)',opacity:r.active?1:0.5}}>
              <div style={{fontSize:20,flexShrink:0}}>{r.type==='checkin_manha'?'🌅':r.type==='checkin_tarde'?'☀️':r.type==='checkin_noite'?'🌙':'🔔'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:'var(--text1)',marginBottom:3}}>{r.title}</div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:'var(--gold)',fontFamily:'Syne, sans-serif',fontWeight:600}}>{r.time?.slice(0,5)}</span>
                  <div style={{display:'flex',gap:2}}>
                    {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                      <span key={i} style={{width:16,height:16,borderRadius:4,fontSize:8,display:'flex',alignItems:'center',justifyContent:'center',background:r.days?.includes(i)?'var(--accent)':'var(--bg3)',color:r.days?.includes(i)?'white':'var(--text3)'}}>{d}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={()=>toggleRm(r.id,r.active)} style={{width:40,height:22,borderRadius:100,border:'none',cursor:'pointer',background:r.active?'var(--teal)':'var(--bg3)',position:'relative',transition:'background .2s',flexShrink:0}}>
                <div style={{position:'absolute',top:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left .2s',left:r.active?'calc(100% - 19px)':'3px'}}/>
              </button>
              <button onClick={()=>removeRm(r.id)} style={{width:28,height:28,borderRadius:8,background:'var(--bg3)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,flexShrink:0}}>×</button>
            </div>
          ))}
          {showRmForm&&(
            <div style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowRmForm(false)}>
              <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',padding:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                  <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>Novo lembrete</h2>
                  <button onClick={()=>setShowRmForm(false)} style={{width:30,height:30,borderRadius:9,background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>×</button>
                </div>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Título</label>
                <input value={rmTitle} onChange={e=>setRmTitle(e.target.value)} placeholder="Ex: Check-in da manhã" style={{...inp,marginBottom:12}}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Hora</label><input type="time" value={rmTime} onChange={e=>setRmTime(e.target.value)} style={inp}/></div>
                  <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Tipo</label>
                    <select value={rmType} onChange={e=>setRmType(e.target.value)} style={inp}>
                      <option value="checkin_manha">🌅 Manhã</option>
                      <option value="checkin_tarde">☀️ Tarde</option>
                      <option value="checkin_noite">🌙 Noite</option>
                      <option value="habito">✅ Hábito</option>
                      <option value="custom">🔔 Personalizado</option>
                    </select>
                  </div>
                </div>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Dias</label>
                <div style={{display:'flex',gap:6,marginBottom:18}}>
                  {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                    <button key={i} onClick={()=>setRmDays(ds=>ds.includes(i)?ds.filter(x=>x!==i):[...ds,i])} style={{flex:1,padding:'9px 0',borderRadius:9,border:'none',cursor:'pointer',fontSize:12,background:rmDays.includes(i)?'var(--accent)':'var(--bg2)',color:rmDays.includes(i)?'white':'var(--text3)',outline:rmDays.includes(i)?'none':'0.5px solid var(--border)'}}>{d}</button>
                  ))}
                </div>
                <button onClick={saveRm} disabled={rmSaving||!rmTitle.trim()} style={{width:'100%',background:rmTitle.trim()?'var(--gold)':'var(--bg3)',color:rmTitle.trim()?'var(--bg0)':'var(--text3)',border:'none',borderRadius:14,padding:14,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                  {rmSaving?'A guardar…':'Guardar lembrete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB AGENDA ─── */}
      {tab==='agenda' && (
        <div style={{padding:'14px 20px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text3)'}}>{events.length} evento{events.length!==1?'s':''} em {format(current,'MMMM',{locale:pt})}</div>
            <button onClick={()=>setShowEvForm(true)} style={{background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:10,padding:'8px 14px',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Evento</button>
          </div>
          {events.length===0&&<div style={{textAlign:'center',padding:'32px 0',color:'var(--text3)',fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📋</div>Sem eventos este mês.</div>}
          {Object.entries(events.reduce((acc:Record<string,AgendaEvent[]>,ev)=>{if(!acc[ev.date])acc[ev.date]=[];acc[ev.date].push(ev);return acc},{})).sort(([a],[b])=>a.localeCompare(b)).map(([date,evs])=>(
            <div key={date} style={{marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--text3)',fontFamily:'Syne, sans-serif',fontWeight:600,marginBottom:6}}>
                {format(new Date(date+'T12:00:00'),"EEEE, d 'de' MMMM",{locale:pt})}
                {isToday(new Date(date+'T12:00:00'))&&<span style={{marginLeft:8,fontSize:10,color:'var(--gold)',background:'rgba(232,168,56,.1)',padding:'2px 8px',borderRadius:6}}>Hoje</span>}
              </div>
              {evs.map(ev=>(
                <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:12,marginBottom:6,background:'var(--bg2)',border:`0.5px solid ${ev.color}40`}}>
                  <div style={{width:3,height:40,borderRadius:2,background:ev.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:'var(--text1)',marginBottom:2}}>{ev.title}</div>
                    {!ev.all_day&&ev.time&&<div style={{fontSize:12,color:'var(--text3)'}}>{ev.time.slice(0,5)}{ev.end_time?` – ${ev.end_time.slice(0,5)}`:''}</div>}
                    {ev.all_day&&<div style={{fontSize:12,color:'var(--text3)'}}>Dia inteiro</div>}
                    {ev.description&&<div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{ev.description}</div>}
                  </div>
                  <button onClick={()=>{deleteAgendaEvent(ev.id);setEvents(e=>e.filter(x=>x.id!==ev.id))}} style={{width:28,height:28,borderRadius:8,background:'var(--bg3)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>×</button>
                </div>
              ))}
            </div>
          ))}
          {showEvForm&&(
            <div style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowEvForm(false)}>
              <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',padding:24,maxHeight:'90vh',overflowY:'auto'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                  <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>Novo evento</h2>
                  <button onClick={()=>setShowEvForm(false)} style={{width:30,height:30,borderRadius:9,background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>×</button>
                </div>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Título</label>
                <input value={evTitle} onChange={e=>setEvTitle(e.target.value)} placeholder="Ex: Consulta, Reunião, Treino…" style={{...inp,marginBottom:12}}/>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Descrição (opcional)</label>
                <input value={evDesc} onChange={e=>setEvDesc(e.target.value)} placeholder="Notas" style={{...inp,marginBottom:12}}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                  <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Data</label><input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)} style={inp}/></div>
                  <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Início</label><input type="time" value={evTime} onChange={e=>setEvTime(e.target.value)} style={inp} disabled={evAllDay}/></div>
                  <div><label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:6}}>Fim</label><input type="time" value={evEndTime} onChange={e=>setEvEndTime(e.target.value)} style={inp} disabled={evAllDay}/></div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <button onClick={()=>setEvAllDay(v=>!v)} style={{width:36,height:20,borderRadius:100,border:'none',cursor:'pointer',background:evAllDay?'var(--teal)':'var(--bg3)',position:'relative',transition:'background .2s'}}>
                    <div style={{position:'absolute',top:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left .2s',left:evAllDay?'calc(100% - 18px)':'2px'}}/>
                  </button>
                  <span style={{fontSize:13,color:'var(--text2)'}}>Dia inteiro</span>
                </div>
                <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Cor</label>
                <div style={{display:'flex',gap:8,marginBottom:18}}>
                  {EVENT_COLORS.map(c=>(
                    <button key={c} onClick={()=>setEvColor(c)} style={{width:28,height:28,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:evColor===c?'2.5px solid white':'none'}}/>
                  ))}
                </div>
                <button onClick={saveEv} disabled={evSaving||!evTitle.trim()} style={{width:'100%',background:evTitle.trim()?'var(--gold)':'var(--bg3)',color:evTitle.trim()?'var(--bg0)':'var(--text3)',border:'none',borderRadius:14,padding:14,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                  {evSaving?'A guardar…':'Guardar evento'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Nav />
    </main>
  )
}
