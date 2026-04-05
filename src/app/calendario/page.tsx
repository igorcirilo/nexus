'use client'
// src/app/calendario/page.tsx — Cal 1 | Cal 2 | Cal 3 | Cal 4 | Cal 5 | Cal 6 | Cal 7 | Cal 8
import { useEffect, useState, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, subMonths, addMonths, startOfWeek, addWeeks, subWeeks,
  eachDayOfInterval as eachDay, endOfWeek, isSameMonth, subDays, addDays,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import {
  supabase, getCalendarData, getCheckinsForDate,
  getReminders, saveReminder, toggleReminder, deleteReminder,
  getAgendaEvents, saveAgendaEvent, deleteAgendaEvent,
  getHabitsWithLogs, toggleHabitLog,
  saveCheckin, addXP,
} from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { AgendaEvent } from '@/lib/supabase'
import type { HabitArea } from '@/types'

type DayStatus     = { habits: number; total: number; checkins: number; complete: boolean }
type Tab           = 'calendario' | 'checkin' | 'lembretes' | 'agenda'
type ViewMode      = 'month' | 'week'
type StreakSide    = 'start' | 'middle' | 'end' | 'solo' | null
type Recurrence    = 'none' | 'semanal' | 'mensal'
type Reminder      = { id: string; title: string; time: string; days: number[]; active: boolean; type: string }
type Checkin       = { phase: string; energy?: number; sleep_hours?: number; mood?: number; mission?: string; win_of_day?: string; xp_earned: number }
type HabitRow      = { id: string; name: string; area: HabitArea; xp_reward: number; habit_logs: { completed: boolean }[] }
type WeekdayStat   = { weekday: number; done: number; total: number }

const DAYS_SHORT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const DAYS_MIN     = ['D','S','T','Q','Q','S','S']
const DAYS_PT_PREP = ['aos domingos','às segundas','às terças','às quartas','às quintas','às sextas','aos sábados']
const PHASE_LABELS: Record<string,string> = { manha:'Manhã', tarde:'Tarde', noite:'Noite' }
const PHASE_EMOJI:  Record<string,string> = { manha:'🌅', tarde:'☀️', noite:'🌙' }
const PHASE_XP:     Record<string,number> = { manha:15, tarde:10, noite:20 }
const EVENT_COLORS  = ['#E8A838','#1ECBB4','#7F77DD','#E24B4A','#1D9E75','#D4537E','#85B7EB']

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg2)', border:'0.5px solid var(--border)',
  borderRadius:12, padding:'11px 14px', color:'var(--text1)',
  fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none',
}

// ── Heatmap ───────────────────────────────────────────────────
function heatColor(status: DayStatus | undefined): string {
  if (!status || status.habits === 0) return 'transparent'
  if (status.complete) return 'var(--teal)'
  const intensity = Math.min(status.habits, 5) / 5
  if (intensity >= 0.8) return 'rgba(30,203,180,.65)'
  if (intensity >= 0.6) return 'rgba(30,203,180,.45)'
  if (intensity >= 0.4) return 'rgba(30,203,180,.28)'
  if (intensity >= 0.2) return 'rgba(30,203,180,.14)'
  return 'rgba(232,168,56,.2)'
}
function heatTextColor(status: DayStatus | undefined, isT: boolean, isSel: boolean): string {
  if (status?.complete) return 'var(--bg0)'
  if (isT) return 'var(--gold)'
  if (isSel) return 'var(--accent)'
  return 'var(--text2)'
}

// ── Cal 4: Streak ─────────────────────────────────────────────
function getStreakSide(dateStr: string, dayMap: Record<string, DayStatus>): StreakSide {
  const hasThis = (dayMap[dateStr]?.habits ?? 0) > 0
  if (!hasThis) return null
  const d       = new Date(dateStr + 'T12:00:00')
  const prev    = format(subDays(d, 1), 'yyyy-MM-dd')
  const next    = format(addDays(d, 1), 'yyyy-MM-dd')
  const hasPrev = (dayMap[prev]?.habits ?? 0) > 0
  const hasNext = (dayMap[next]?.habits ?? 0) > 0
  if (hasPrev && hasNext) return 'middle'
  if (hasPrev) return 'end'
  if (hasNext) return 'start'
  return 'solo'
}
function computeCurrentStreak(dayMap: Record<string, DayStatus>): number {
  let streak = 0; let d = new Date()
  while (streak < 400) {
    const ds = format(d, 'yyyy-MM-dd')
    if ((dayMap[ds]?.habits ?? 0) > 0) { streak++; d = subDays(d, 1) } else break
  }
  return streak
}
function streakBarStyle(side: StreakSide): React.CSSProperties {
  if (!side) return { display: 'none' }
  const base: React.CSSProperties = { position:'absolute', bottom:0, height:3, background:'rgba(30,203,180,.8)' }
  if (side === 'solo')   return { ...base, left:4, right:4, borderRadius:3 }
  if (side === 'start')  return { ...base, left:4, right:0, borderRadius:'3px 0 0 3px' }
  if (side === 'end')    return { ...base, left:0, right:4, borderRadius:'0 3px 3px 0' }
  return { ...base, left:0, right:0, borderRadius:0 }
}

// ── Cal 8: Padrões ────────────────────────────────────────────
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getPatternInsights(patterns: WeekdayStat[]): string[] {
  const withData = patterns.filter(p => p.total >= 2)
  if (withData.length < 3) return []
  const withPct = withData.map(p => ({ ...p, pct: Math.round(p.done / p.total * 100) }))
  withPct.sort((a, b) => b.pct - a.pct)
  const insights: string[] = []
  const best  = withPct[0]
  const worst = withPct[withPct.length - 1]
  if (best.pct >= 50)
    insights.push(`${capitalize(DAYS_PT_PREP[best.weekday])} és ${best.pct}% consistente — o teu melhor dia.`)
  if (worst.pct < best.pct && worst.weekday !== best.weekday)
    insights.push(`${capitalize(DAYS_PT_PREP[worst.weekday])} costumas falhar mais (${worst.pct}%).`)
  const diff = best.pct - worst.pct
  if (diff >= 35 && insights.length >= 2)
    insights.push(`Diferença de ${diff}% entre o teu melhor e pior dia — há margem para crescer.`)
  return insights
}

// ── Componente principal ──────────────────────────────────────
export default function CalendarioPage() {
  const [userId,      setUserId]      = useState<string|null>(null)
  const [tab,         setTab]         = useState<Tab>('calendario')
  const [viewMode,    setViewMode]    = useState<ViewMode>('month')
  const [current,     setCurrent]     = useState(new Date())
  const [weekStart,   setWeekStart]   = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [dayMap,      setDayMap]      = useState<Record<string,DayStatus>>({})
  const [selected,    setSelected]    = useState<string|null>(null)
  const [selCheckins, setSelCheckins] = useState<Checkin[]>([])
  const [selEvents,   setSelEvents]   = useState<AgendaEvent[]>([])
  const [selHabits,   setSelHabits]   = useState<HabitRow[]>([])
  const [panelLoad,   setPanelLoad]   = useState(false)
  const [reminders,   setReminders]   = useState<Reminder[]>([])
  const [events,      setEvents]      = useState<AgendaEvent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [todayCI,     setTodayCI]     = useState<Checkin[]>([])
  const [toast,       setToast]       = useState('')

  // Cal 7: quick check-in
  const [quickPhase,   setQuickPhase]   = useState<string|null>(null)
  const [quickEnergy,  setQuickEnergy]  = useState(7)
  const [quickMission, setQuickMission] = useState('')
  const [quickWin,     setQuickWin]     = useState('')
  const [quickSaving,  setQuickSaving]  = useState(false)

  // Cal 8: padrões
  const [patterns,        setPatterns]        = useState<WeekdayStat[]>([])
  const [patternsLoaded,  setPatternsLoaded]  = useState(false)

  // Lembretes form
  const [showRmForm, setShowRmForm] = useState(false)
  const [rmTitle,    setRmTitle]    = useState('')
  const [rmTime,     setRmTime]     = useState('08:00')
  const [rmDays,     setRmDays]     = useState<number[]>([1,2,3,4,5])
  const [rmType,     setRmType]     = useState('custom')
  const [rmSaving,   setRmSaving]   = useState(false)

  // Agenda form (Cal 6: + evRecurrence)
  const [showEvForm,   setShowEvForm]   = useState(false)
  const [evTitle,      setEvTitle]      = useState('')
  const [evDesc,       setEvDesc]       = useState('')
  const [evDate,       setEvDate]       = useState(format(new Date(),'yyyy-MM-dd'))
  const [evTime,       setEvTime]       = useState('')
  const [evEndTime,    setEvEndTime]    = useState('')
  const [evColor,      setEvColor]      = useState('#E8A838')
  const [evAllDay,     setEvAllDay]     = useState(false)
  const [evRecurrence, setEvRecurrence] = useState<Recurrence>('none')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [evSaving,     setEvSaving]     = useState(false)

  const today = format(new Date(),'yyyy-MM-dd')

  function showToast(m: string) { setToast(m); setTimeout(()=>setToast(''),2800) }


  function resetEventForm() {
    setEditingEventId(null)
    setEvTitle('')
    setEvDesc('')
    setEvDate(format(new Date(), 'yyyy-MM-dd'))
    setEvTime('')
    setEvEndTime('')
    setEvColor('#E8A838')
    setEvAllDay(false)
    setEvRecurrence('none')
  }

  function openNewEventForm(dateStr?: string) {
    resetEventForm()
    if (dateStr) setEvDate(dateStr)
    setShowEvForm(true)
  }

  function openEditEventForm(event: AgendaEvent) {
    setEditingEventId(event.id)
    setEvTitle(event.title)
    setEvDesc(event.description ?? '')
    setEvDate(event.date)
    setEvTime(event.time?.slice(0, 5) ?? '')
    setEvEndTime(event.end_time?.slice(0, 5) ?? '')
    setEvColor(event.color)
    setEvAllDay(event.all_day)
    setEvRecurrence('none')
    setShowEvForm(true)
  }

  async function handleDeleteEvent(eventId: string) {
    if (!userId) return
    const { error } = await deleteAgendaEvent(eventId, userId)
    if (error) {
      showToast('Erro ao remover evento')
      return
    }
    setEvents(prev => prev.filter(event => event.id !== eventId))
    setSelEvents(prev => prev.filter(event => event.id !== eventId))
    showToast('Evento removido!')
    await loadMonth(userId, current)
  }

  // ── loadMonth ─────────────────────────────────────────────
  const loadMonth = useCallback(async (uid: string, date: Date) => {
    const [calData, evs] = await Promise.all([
      getCalendarData(uid, date.getFullYear(), date.getMonth()+1),
      getAgendaEvents(uid, date.getFullYear(), date.getMonth()+1),
    ])
    setEvents(evs)
    const map: Record<string,DayStatus> = {}
    ;(calData.logs as {date:string;completed:boolean}[]).forEach(l => {
      if (!map[l.date]) map[l.date] = { habits:0, total:0, checkins:0, complete:false }
      map[l.date].total++
      if (l.completed) map[l.date].habits++
    })
    ;(calData.checkins as {date:string}[]).forEach(c => {
      if (!map[c.date]) map[c.date] = { habits:0, total:0, checkins:0, complete:false }
      map[c.date].checkins++
    })
    Object.values(map).forEach(d => { d.complete = d.checkins >= 2 && d.habits >= 1 })
    setDayMap(map)
  }, [])

  // ── Cal 8: loadPatterns ───────────────────────────────────
  const loadPatterns = useCallback(async (uid: string) => {
    const now = new Date()
    const m1  = subMonths(now, 1)
    const m2  = subMonths(now, 2)
    const [d0, d1, d2] = await Promise.all([
      getCalendarData(uid, now.getFullYear(), now.getMonth()+1),
      getCalendarData(uid, m1.getFullYear(),  m1.getMonth()+1),
      getCalendarData(uid, m2.getFullYear(),  m2.getMonth()+1),
    ])
    const allLogs = [
      ...(d0.logs as {date:string;completed:boolean}[]),
      ...(d1.logs as {date:string;completed:boolean}[]),
      ...(d2.logs as {date:string;completed:boolean}[]),
    ]
    // por data: quantos hábitos feitos
    const byDate: Record<string,{done:number;total:number}> = {}
    allLogs.forEach(l => {
      if (!byDate[l.date]) byDate[l.date] = { done:0, total:0 }
      byDate[l.date].total++
      if (l.completed) byDate[l.date].done++
    })
    // por dia da semana
    const stats: WeekdayStat[] = Array.from({length:7},(_,i)=>({weekday:i,done:0,total:0}))
    Object.entries(byDate).forEach(([ds, s]) => {
      if (ds > today) return
      const wd = getDay(new Date(ds+'T12:00:00'))
      stats[wd].done  += s.done > 0 ? 1 : 0
      stats[wd].total += 1
    })
    setPatterns(stats)
    setPatternsLoaded(true)
  }, [today])

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
      loadPatterns(user.id) // Cal 8: carrega padrões em background
    })
  }, [today, loadMonth, loadPatterns])

  async function changeMonth(dir: 1|-1) {
    const next = dir===1 ? addMonths(current,1) : subMonths(current,1)
    setCurrent(next)
    if (userId) await loadMonth(userId, next)
  }
  function changeWeek(dir: 1|-1) {
    const next = dir===1 ? addWeeks(weekStart,1) : subWeeks(weekStart,1)
    setWeekStart(next)
    const weekEnd = endOfWeek(next, { weekStartsOn: 1 })
    if (userId && !isSameMonth(next, current)) {
      setCurrent(next); loadMonth(userId, next)
    } else if (userId && !isSameMonth(weekEnd, current)) {
      loadMonth(userId, next)
    }
  }

  async function selectDay(dateStr: string) {
    if (selected === dateStr) { setSelected(null); return }
    setSelected(dateStr)
    setQuickPhase(null)
    if (!userId) return
    setPanelLoad(true)
    const [ci, evRes, habits] = await Promise.all([
      getCheckinsForDate(userId, dateStr),
      supabase.from('agenda_events').select('*').eq('user_id',userId).eq('date',dateStr).order('time'),
      getHabitsWithLogs(userId, dateStr),
    ])
    setSelCheckins(ci as Checkin[])
    setSelEvents((evRes.data ?? []) as AgendaEvent[])
    setSelHabits(habits as HabitRow[])
    setPanelLoad(false)
  }

  // Cal 5: retroactivo
  async function toggleRetroHabit(habitId: string, currentDone: boolean, dateStr: string) {
    if (!userId) return
    await toggleHabitLog(userId, habitId, dateStr, !currentDone)
    const habits = await getHabitsWithLogs(userId, dateStr)
    setSelHabits(habits as HabitRow[])
    loadMonth(userId, current)
    showToast(currentDone ? 'Desmarcado' : 'Marcado ✓ (sem XP)')
  }

  // Cal 7: quick check-in
  async function doQuickCheckin() {
    if (!userId || !quickPhase || !selected) return
    setQuickSaving(true)
    const xp = PHASE_XP[quickPhase] ?? 10
    await saveCheckin({
      user_id: userId, date: selected, phase: quickPhase,
      energy: quickEnergy,
      mission:    quickPhase === 'manha' ? (quickMission.trim() || null) : null,
      win_of_day: quickPhase === 'noite' ? (quickWin.trim()    || null) : null,
      xp_earned: xp,
      completed_at: new Date().toISOString(),
    })
    await addXP(userId, xp)
    const ci = await getCheckinsForDate(userId, selected)
    setSelCheckins(ci as Checkin[])
    if (selected === today) setTodayCI(ci as Checkin[])
    await loadMonth(userId, current)
    setQuickPhase(null); setQuickEnergy(7); setQuickMission(''); setQuickWin('')
    setQuickSaving(false)
    showToast(`Check-in da ${PHASE_LABELS[quickPhase]} guardado! +${xp} XP 🎉`)
  }

  // Lembretes
  async function saveRm() {
    if (!userId || !rmTitle.trim()) return
    setRmSaving(true)
    await saveReminder({ user_id:userId, title:rmTitle, time:rmTime, days:rmDays, type:rmType, active:true })
    setReminders(await getReminders(userId) as Reminder[])
    setShowRmForm(false); setRmTitle(''); setRmDays([1,2,3,4,5])
    showToast('Lembrete criado!'); setRmSaving(false)
  }
  async function toggleRm(id: string, active: boolean) {
    if (!userId) return
    await toggleReminder(id, !active)
    setReminders(await getReminders(userId) as Reminder[])
    showToast(!active ? 'Ativado!' : 'Desativado!')
  }
  async function removeRm(id: string) {
    if (!userId) return
    await deleteReminder(id)
    setReminders(prev => prev.filter(r => r.id !== id))
    showToast('Lembrete removido!')
  }

  // Cal 6: guardar evento com recorrência
  async function saveEv() {
    if (!userId || !evTitle.trim()) return
    setEvSaving(true)

    const basePayload = {
      user_id: userId,
      title: evTitle,
      description: evDesc || null,
      date: evDate,
      time: evTime || null,
      end_time: evEndTime || null,
      color: evColor,
      all_day: evAllDay,
    }

    if (editingEventId) {
      const { error } = await saveAgendaEvent({ id: editingEventId, ...basePayload })
      if (error) {
        showToast('Erro ao guardar evento')
        setEvSaving(false)
        return
      }

      await loadMonth(userId, new Date(evDate + 'T12:00:00'))
      if (selected === evDate) await selectDay(evDate)
      setShowEvForm(false)
      resetEventForm()
      setEvSaving(false)
      showToast('Evento atualizado!')
      return
    }

    const baseDate = new Date(evDate + 'T12:00:00')
    const dates: string[] = [evDate]
    if (evRecurrence === 'semanal') {
      for (let i = 1; i < 12; i++) dates.push(format(addWeeks(baseDate, i), 'yyyy-MM-dd'))
    } else if (evRecurrence === 'mensal') {
      for (let i = 1; i < 6; i++) dates.push(format(addMonths(baseDate, i), 'yyyy-MM-dd'))
    }

    const results = await Promise.all(
      dates.map((date) => saveAgendaEvent({ ...basePayload, date }))
    )

    const hasError = results.some((result) => result.error)
    if (hasError) {
      showToast('Erro ao guardar evento')
      setEvSaving(false)
      return
    }

    await loadMonth(userId, new Date(evDate + 'T12:00:00'))
    if (selected === evDate) await selectDay(evDate)
    setShowEvForm(false)
    resetEventForm()
    const msg = evRecurrence === 'semanal' ? '12 semanas criadas!' : evRecurrence === 'mensal' ? '6 meses criados!' : 'Evento adicionado!'
    showToast(msg)
    setEvSaving(false)
  }

  const days     = eachDayOfInterval({ start:startOfMonth(current), end:endOfMonth(current) })
  const startPad = getDay(startOfMonth(current))
  const doneDays = Object.values(dayMap).filter(d=>d.complete).length
  const weekDays = eachDay({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })
  const currentStreak = computeCurrentStreak(dayMap)
  const patternInsights = patternsLoaded ? getPatternInsights(patterns) : []

  const TABS: {key:Tab;label:string;icon:string}[] = [
    {key:'calendario',label:'Calendário',icon:'📅'},
    {key:'checkin',   label:'Check-in',  icon:'✅'},
    {key:'lembretes', label:'Alertas',   icon:'🔔'},
    {key:'agenda',    label:'Agenda',    icon:'📋'},
  ]

  // ── Cal 3 + Cal 7: Painel do dia ─────────────────────────
  function DayPanel({ dateStr }: { dateStr: string }) {
    const isPast    = dateStr < today
    const isToday_  = dateStr === today
    const totalXP   = selCheckins.reduce((s, c) => s + (c.xp_earned ?? 0), 0)
    const status    = dayMap[dateStr]
    const hasData   = selCheckins.length > 0 || selHabits.length > 0 || selEvents.length > 0
    const donePhases = selCheckins.map(c => c.phase)
    const missingPhases = (['manha','tarde','noite'] as const).filter(p => !donePhases.includes(p))

    return (
      <div style={{paddingTop:14,marginTop:14,borderTop:'0.5px solid var(--border)'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,color:'var(--text1)',lineHeight:1.3}}>
              {format(new Date(dateStr+'T12:00:00'),"EEEE, d 'de' MMMM",{locale:pt})}
            </div>
            {isPast && !isToday_ && (
              <div style={{fontSize:10,color:'var(--text3)',marginTop:3,display:'flex',alignItems:'center',gap:4}}>
                <span style={{background:'rgba(127,119,221,.15)',color:'var(--accent)',padding:'1px 6px',borderRadius:5,fontSize:9,fontWeight:600}}>RETRO</span>
                clica nos hábitos para marcar (sem XP)
              </div>
            )}
          </div>
          {totalXP > 0 && (
            <div style={{background:'rgba(232,168,56,.12)',border:'0.5px solid rgba(232,168,56,.3)',borderRadius:10,padding:'4px 10px',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,color:'var(--gold)',whiteSpace:'nowrap',flexShrink:0}}>
              +{totalXP} XP
            </div>
          )}
        </div>

        {panelLoad ? (
          <div style={{textAlign:'center',padding:'16px 0',fontSize:12,color:'var(--text3)'}}>a carregar…</div>
        ) : (
          <>
            {/* ── Cal 7: Quick check-in (só hoje) ── */}
            {isToday_ && missingPhases.length > 0 && (
              <div style={{marginBottom:14,padding:12,borderRadius:14,background:'rgba(30,203,180,.05)',border:'0.5px solid rgba(30,203,180,.18)'}}>
                <div style={{fontSize:10,color:'var(--teal)',fontWeight:700,letterSpacing:'.06em',marginBottom:9}}>CHECK-IN RÁPIDO</div>
                <div style={{display:'flex',gap:6,marginBottom: quickPhase ? 12 : 0}}>
                  {missingPhases.map(phase=>(
                    <button key={phase} onClick={()=>setQuickPhase(quickPhase===phase ? null : phase)} style={{
                      flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                      padding:'9px 6px',borderRadius:11,border:'none',cursor:'pointer',
                      background: quickPhase===phase ? 'rgba(30,203,180,.18)' : 'var(--bg3)',
                      outline: quickPhase===phase ? '1.5px solid var(--teal)' : '0.5px solid var(--border)',
                      transition:'all .15s',
                    }}>
                      <span style={{fontSize:14}}>{PHASE_EMOJI[phase]}</span>
                      <span style={{fontSize:11,fontFamily:'Syne, sans-serif',fontWeight:600,color:quickPhase===phase?'var(--teal)':'var(--text2)'}}>
                        {PHASE_LABELS[phase]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Mini form do check-in */}
                {quickPhase && (
                  <div>
                    {/* Energia */}
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:'var(--text3)',marginBottom:6}}>Energia · {quickEnergy}/10</div>
                      <div style={{display:'flex',gap:4}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                          <button key={n} onClick={()=>setQuickEnergy(n)} style={{
                            flex:1,padding:'6px 0',borderRadius:7,border:'none',cursor:'pointer',
                            background: n<=quickEnergy ? 'var(--teal)' : 'var(--bg3)',
                            fontSize:10,color: n<=quickEnergy ? 'var(--bg0)' : 'var(--text3)',
                            fontFamily:'Syne, sans-serif',fontWeight:700,
                            transition:'all .1s',
                          }}>{n}</button>
                        ))}
                      </div>
                    </div>
                    {/* Campo extra por fase */}
                    {quickPhase==='manha' && (
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Intenção do dia (opcional)</div>
                        <input value={quickMission} onChange={e=>setQuickMission(e.target.value)} placeholder="O que queres conquistar hoje?" style={{...inp,fontSize:13,padding:'9px 12px'}}/>
                      </div>
                    )}
                    {quickPhase==='noite' && (
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Vitória do dia (opcional)</div>
                        <input value={quickWin} onChange={e=>setQuickWin(e.target.value)} placeholder="Algo que correu bem hoje…" style={{...inp,fontSize:13,padding:'9px 12px'}}/>
                      </div>
                    )}
                    <button onClick={doQuickCheckin} disabled={quickSaving} style={{
                      width:'100%',padding:'10px',borderRadius:11,border:'none',cursor:'pointer',
                      background:'var(--teal)',color:'var(--bg0)',
                      fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,
                      opacity:quickSaving?0.7:1,
                    }}>
                      {quickSaving ? 'A guardar…' : `Guardar check-in da ${PHASE_LABELS[quickPhase]} +${PHASE_XP[quickPhase]} XP`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Hábitos (Cal 3 + Cal 5) ── */}
            {selHabits.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
                  <span style={{fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:'.06em'}}>HÁBITOS</span>
                  {status && status.total > 0 && (
                    <span style={{fontSize:11,color:'var(--teal)',fontFamily:'Syne, sans-serif',fontWeight:600}}>
                      {status.habits}/{status.total}
                    </span>
                  )}
                </div>
                {status && status.total > 0 && (
                  <div style={{background:'var(--bg3)',borderRadius:100,height:4,marginBottom:9}}>
                    <div style={{height:'100%',borderRadius:100,background:'var(--teal)',width:`${Math.round((status.habits/status.total)*100)}%`,transition:'width .4s'}}/>
                  </div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {selHabits.map(h => {
                    const done    = (h.habit_logs ?? []).length > 0 && h.habit_logs[0].completed
                    const meta    = AREA_META[h.area] ?? { icon:'✅', color:'var(--teal)', label:'' }
                    const canEdit = isPast && !isToday_
                    return (
                      <div key={h.id} onClick={canEdit ? ()=>toggleRetroHabit(h.id,done,dateStr) : undefined} style={{
                        display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:11,
                        background:done?'rgba(30,203,180,.07)':'var(--bg3)',
                        border:done?'0.5px solid rgba(30,203,180,.22)':'0.5px solid transparent',
                        cursor:canEdit?'pointer':'default',transition:'all .15s',userSelect:'none',
                      }}>
                        <div style={{width:20,height:20,borderRadius:6,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:done?'var(--teal)':'transparent',border:done?'none':'1.5px solid var(--text3)',transition:'all .15s'}}>
                          {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="var(--bg0)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,4 3.5,7 9,1"/></svg>}
                        </div>
                        <span style={{fontSize:14}}>{meta.icon}</span>
                        <span style={{flex:1,fontSize:13,color:done?'var(--text1)':'var(--text2)',fontWeight:done?500:400}}>{h.name}</span>
                        {canEdit && <span style={{fontSize:10,color:'var(--text3)',opacity:.7}}>{done?'desfazer':'marcar'}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Check-ins ── */}
            {selCheckins.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:'.06em',marginBottom:7}}>CHECK-INS</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {selCheckins.map((ci,i) => (
                    <div key={i} style={{padding:'10px 12px',borderRadius:11,background:'var(--bg3)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:(ci.energy||ci.mission||ci.win_of_day)?5:0}}>
                        <span style={{fontSize:15}}>{PHASE_EMOJI[ci.phase]??'⏰'}</span>
                        <span style={{flex:1,fontSize:13,color:'var(--text1)',fontWeight:600}}>{PHASE_LABELS[ci.phase]??ci.phase}</span>
                        <span style={{fontSize:11,color:'var(--gold)',fontFamily:'Syne, sans-serif',fontWeight:700}}>+{ci.xp_earned} XP</span>
                      </div>
                      {(ci.energy||ci.sleep_hours||ci.mood) && (
                        <div style={{display:'flex',gap:10,fontSize:11,color:'var(--text3)',flexWrap:'wrap'}}>
                          {ci.energy      && <span>⚡ {ci.energy}/10</span>}
                          {ci.sleep_hours && <span>😴 {ci.sleep_hours}h</span>}
                          {ci.mood        && <span>💭 humor {ci.mood}/10</span>}
                        </div>
                      )}
                      {ci.mission    && ci.phase==='manha' && <div style={{fontSize:12,color:'var(--text2)',fontStyle:'italic',marginTop:4}}>&ldquo;{ci.mission}&rdquo;</div>}
                      {ci.win_of_day && <div style={{fontSize:12,color:'var(--teal)',marginTop:4}}>🏆 {ci.win_of_day}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Eventos ── */}
            {selEvents.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:'.06em',marginBottom:7}}>EVENTOS</div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {selEvents.map(ev => (
                    <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:11,background:'var(--bg3)'}}>
                      <div style={{width:3,height:34,borderRadius:2,background:ev.color,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:'var(--text1)',fontWeight:500}}>{ev.title}</div>
                        {!ev.all_day && ev.time && <div style={{fontSize:11,color:'var(--text3)'}}>{ev.time.slice(0,5)}{ev.end_time?` – ${ev.end_time.slice(0,5)}`:''}</div>}
                        {ev.all_day && <div style={{fontSize:11,color:'var(--text3)'}}>Dia inteiro</div>}
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0}}><button onClick={()=>openEditEventForm(ev)} style={{width:26,height:26,borderRadius:7,background:'var(--bg2)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:12}}>✎</button><button onClick={()=>handleDeleteEvent(ev.id)} style={{width:26,height:26,borderRadius:7,background:'var(--bg2)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>×</button></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasData && !isToday_ && (
              <div style={{textAlign:'center',padding:'12px 0',fontSize:12,color:'var(--text3)'}}>Sem registos neste dia.</div>
            )}
            <button onClick={()=>{openNewEventForm(dateStr);setTab('agenda')}} style={{width:'100%',marginTop:4,padding:'9px',border:'0.5px solid rgba(30,203,180,.28)',borderRadius:11,background:'rgba(30,203,180,.06)',color:'var(--teal)',cursor:'pointer',fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:12}}>
              + Evento neste dia
            </button>
          </>
        )}
      </div>
    )
  }

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
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:'8px 3px',borderRadius:10,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:tab===t.key?'var(--bg1)':'transparent',color:tab===t.key?'var(--gold)':'var(--text3)',transition:'all .15s',fontSize:9,fontFamily:'Syne, sans-serif',fontWeight:tab===t.key?600:400}}>
              <span style={{fontSize:16}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CALENDÁRIO ─── */}
      {tab==='calendario' && (
        <div style={{padding:'14px 20px 0'}}>
          {/* Métricas */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
            {[
              {label:'Completos',value:doneDays,color:'var(--teal)'},
              {label:'Parciais', value:Object.values(dayMap).filter(d=>!d.complete&&(d.checkins>0||d.habits>0)).length,color:'var(--accent)'},
              {label:'% do mês', value:days.length>0?Math.round(doneDays/days.length*100)+'%':'0%',color:'var(--gold)'},
            ].map(({label,value,color})=>(
              <div key={label} style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
                <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:22,color,lineHeight:1}}>{value}</div>
                <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Toggle mês/semana */}
          <div style={{display:'flex',background:'var(--bg2)',borderRadius:12,padding:3,gap:2,border:'0.5px solid var(--border)',marginBottom:14}}>
            {(['month','week'] as ViewMode[]).map(v=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{flex:1,padding:'7px 0',borderRadius:9,border:'none',cursor:'pointer',background:viewMode===v?'var(--bg1)':'transparent',color:viewMode===v?'var(--teal)':'var(--text3)',fontSize:12,fontFamily:'Syne, sans-serif',fontWeight:viewMode===v?700:400,transition:'all .15s'}}>
                {v==='month'?'📅 Mês':'📆 Semana'}
              </button>
            ))}
          </div>

          {/* ── VISTA MENSAL ── */}
          {viewMode==='month' && (
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:20,padding:'16px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <button onClick={()=>changeMonth(-1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:16,color:'var(--text1)'}}>{format(current,'MMMM yyyy',{locale:pt})}</div>
                  {currentStreak >= 1 && (
                    <div style={{fontSize:11,marginTop:3,color:currentStreak>=7?'var(--gold)':currentStreak>=3?'var(--teal)':'var(--text3)'}}>
                      🔥 {currentStreak===1?'1 dia de sequência':`${currentStreak} dias seguidos`}
                    </div>
                  )}
                </div>
                <button onClick={()=>changeMonth(1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:6}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'var(--text3)',paddingBottom:6,fontWeight:600,letterSpacing:'.02em'}}>{d}</div>)}
                {Array.from({length:startPad}).map((_,i)=><div key={`p${i}`}/>)}
                {days.map(day=>{
                  const dateStr = format(day,'yyyy-MM-dd')
                  const isT     = isToday(day)
                  const isSel   = selected===dateStr
                  const future  = day > new Date()
                  const status  = dayMap[dateStr]
                  const hasEv   = events.some(e=>e.date===dateStr)
                  const bg      = isSel ? 'rgba(127,119,221,.25)' : heatColor(status)
                  const side    = future ? null : getStreakSide(dateStr, dayMap)
                  return (
                    <button key={dateStr} onClick={()=>selectDay(dateStr)} style={{aspectRatio:'1',borderRadius:10,border:'none',cursor:'pointer',background:bg,outline:isT?'2px solid var(--gold)':isSel?'1.5px solid rgba(127,119,221,.6)':'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,opacity:future?0.25:1,transition:'all .15s',position:'relative',overflow:'hidden'}}>
                      <span style={{fontFamily:'Syne, sans-serif',fontWeight:isT?700:500,fontSize:14,color:heatTextColor(status,isT,isSel),lineHeight:1}}>{format(day,'d')}</span>
                      {(status?.checkins>0||status?.habits>0||hasEv)&&(
                        <div style={{display:'flex',gap:2}}>
                          {status?.checkins>0&&<div style={{width:3,height:3,borderRadius:'50%',background:status.complete?'var(--bg0)':'var(--accent)'}}/>}
                          {status?.habits>0&&<div style={{width:3,height:3,borderRadius:'50%',background:status.complete?'var(--bg0)':'var(--gold)'}}/>}
                          {hasEv&&<div style={{width:3,height:3,borderRadius:'50%',background:status?.complete?'var(--bg0)':'var(--teal)'}}/>}
                        </div>
                      )}
                      {side && <div style={streakBarStyle(side)}/>}
                    </button>
                  )
                })}
              </div>
              <div style={{paddingTop:10,borderTop:'0.5px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:10,color:'var(--text3)',marginBottom:5}}>Intensidade de hábitos</div>
                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                      {['transparent','rgba(30,203,180,.14)','rgba(30,203,180,.28)','rgba(30,203,180,.45)','rgba(30,203,180,.65)','var(--teal)'].map((c,i)=>(
                        <div key={i} style={{width:15,height:15,borderRadius:4,background:c,border:'0.5px solid var(--border)'}}/>
                      ))}
                      <span style={{fontSize:10,color:'var(--text3)',marginLeft:2}}>→</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:10,color:'var(--text3)',marginBottom:5}}>Sequência</div>
                    <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
                      <div style={{width:26,height:3,borderRadius:3,background:'rgba(30,203,180,.8)'}}/>
                      <span style={{fontSize:10,color:'var(--text3)'}}>streak</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── VISTA SEMANAL ── */}
          {viewMode==='week' && (
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:20,padding:'16px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <button onClick={()=>changeWeek(-1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
                <span style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,color:'var(--text1)'}}>
                  {format(weekStart,'d MMM',{locale:pt})} – {format(endOfWeek(weekStart,{weekStartsOn:1}),'d MMM',{locale:pt})}
                </span>
                <button onClick={()=>changeWeek(1)} style={{width:36,height:36,borderRadius:11,background:'var(--bg3)',border:'0.5px solid var(--border)',cursor:'pointer',color:'var(--text2)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
                {weekDays.map(day=>{
                  const dateStr = format(day,'yyyy-MM-dd')
                  const isT     = isToday(day)
                  const isSel   = selected===dateStr
                  const future  = day > new Date()
                  const status  = dayMap[dateStr]
                  const dayEvs  = events.filter(e=>e.date===dateStr)
                  const pct     = status?.total > 0 ? Math.round((status.habits/status.total)*100) : 0
                  const bg      = isSel ? 'rgba(127,119,221,.2)' : heatColor(status)
                  const side    = future ? null : getStreakSide(dateStr, dayMap)
                  return (
                    <button key={dateStr} onClick={()=>selectDay(dateStr)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 4px',borderRadius:14,border:'none',cursor:'pointer',background:bg,outline:isT?'2px solid var(--gold)':isSel?'1.5px solid var(--accent)':'none',opacity:future?0.3:1,transition:'all .15s',position:'relative',overflow:'hidden'}}>
                      <div style={{fontSize:9,color:isT?'var(--gold)':'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px'}}>{DAYS_MIN[getDay(day)]}</div>
                      <div style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:15,color:status?.complete?'var(--bg0)':isT?'var(--gold)':isSel?'var(--accent)':'var(--text1)',lineHeight:1}}>{format(day,'d')}</div>
                      {!future && (
                        <div style={{width:'100%',padding:'0 2px'}}>
                          <div style={{background:'rgba(255,255,255,.1)',borderRadius:100,height:3}}>
                            <div style={{height:'100%',borderRadius:100,background:status?.complete?'var(--bg0)':'var(--teal)',width:`${pct}%`,transition:'width .4s'}}/>
                          </div>
                        </div>
                      )}
                      {dayEvs.length>0&&<div style={{display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center'}}>{dayEvs.slice(0,3).map(ev=>(<div key={ev.id} style={{width:5,height:5,borderRadius:'50%',background:ev.color}}/>))}</div>}
                      {side && <div style={streakBarStyle(side)}/>}
                    </button>
                  )
                })}
              </div>
              {selected && weekDays.some(d=>format(d,'yyyy-MM-dd')===selected) && (
                <DayPanel dateStr={selected}/>
              )}
            </div>
          )}

          {/* Painel mensal */}
          {viewMode==='month' && selected && (
            <div style={{background:'var(--bg2)',border:'0.5px solid rgba(127,119,221,.22)',borderRadius:16,padding:16,marginBottom:14}}>
              <DayPanel dateStr={selected}/>
            </div>
          )}

          {/* ── Cal 8: Padrões automáticos ── */}
          {patternsLoaded && (
            <div style={{background:'var(--bg2)',border:'0.5px solid var(--border)',borderRadius:16,padding:'14px 16px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:16}}>📊</span>
                <span style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,color:'var(--text1)'}}>Padrões</span>
                <span style={{fontSize:10,color:'var(--text3)',marginLeft:'auto'}}>últimos 3 meses</span>
              </div>

              {/* Barra por dia da semana */}
              <div style={{display:'flex',gap:4,marginBottom:12,alignItems:'flex-end',height:48}}>
                {patterns.map(p=>{
                  const pct  = p.total > 0 ? Math.round(p.done/p.total*100) : 0
                  const best = [...patterns].sort((a,b)=>(b.total>0?b.done/b.total:0)-(a.total>0?a.done/a.total:0))[0]
                  const isBest = p.weekday === best.weekday && p.total >= 2
                  return (
                    <div key={p.weekday} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                      <div style={{fontSize:9,color:isBest?'var(--gold)':'var(--text3)',fontWeight:isBest?700:400}}>{pct}%</div>
                      <div style={{width:'100%',background:'var(--bg3)',borderRadius:4,overflow:'hidden',height:28}}>
                        <div style={{width:'100%',height:`${p.total===0?0:Math.max(4,pct)}%`,background:isBest?'var(--gold)':pct>=60?'var(--teal)':pct>=30?'rgba(30,203,180,.45)':'rgba(30,203,180,.18)',borderRadius:4,marginTop:'auto',position:'relative',bottom:0}}/>
                      </div>
                      <div style={{fontSize:9,color:'var(--text3)'}}>{DAYS_SHORT[p.weekday]}</div>
                    </div>
                  )
                })}
              </div>

              {/* Insights */}
              {patternInsights.length > 0 ? (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {patternInsights.map((txt,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',borderRadius:10,background:'var(--bg3)'}}>
                      <span style={{fontSize:13,flexShrink:0}}>{i===0?'⭐':'⚠️'}</span>
                      <span style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{txt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'4px 0'}}>
                  Ainda a recolher padrões — continua a registar hábitos.
                </div>
              )}
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
                      {ci.mission&&phase==='manha'&&<div style={{fontStyle:'italic',color:'var(--text3)'}}>&ldquo;{ci.mission}&rdquo;</div>}
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
            <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowRmForm(false)}>
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
            <button onClick={()=>openNewEventForm()} style={{background:'var(--gold)',color:'var(--bg0)',border:'none',borderRadius:10,padding:'8px 14px',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Evento</button>
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
                  <div style={{display:'flex',gap:6}}><button onClick={()=>openEditEventForm(ev)} style={{width:28,height:28,borderRadius:8,background:'var(--bg3)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:13}}>✎</button><button onClick={()=>handleDeleteEvent(ev.id)} style={{width:28,height:28,borderRadius:8,background:'var(--bg3)',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14}}>×</button></div>
                </div>
              ))}
            </div>
          ))}

          {/* ── Cal 6: Form com recorrência ── */}
          {showEvForm&&(
            <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end'}} onClick={e=>{ if (e.target===e.currentTarget) { setShowEvForm(false); resetEventForm() } }}>
              <div style={{width:'100%',maxWidth:448,margin:'0 auto',background:'var(--bg1)',borderRadius:'20px 20px 0 0',borderTop:'0.5px solid var(--border)',display:'flex',flexDirection:'column',maxHeight:'90vh'}}>
                <div style={{padding:'24px 24px 0',overflowY:'auto',flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                    <h2 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18}}>{editingEventId ? 'Editar evento' : 'Novo evento'}</h2>
                    <button onClick={()=>{setShowEvForm(false); resetEventForm()}} style={{width:30,height:30,borderRadius:9,background:'var(--bg3)',border:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>×</button>
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

                  {/* Cal 6: Recorrência */}
                  <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Recorrência</label>
                  <div style={{display:'flex',gap:6,marginBottom:14}}>
                    {([
                      {key:'none'   as Recurrence, label:'Não repete', icon:'1️⃣'},
                      {key:'semanal'as Recurrence, label:'Semanal · 12×', icon:'📅'},
                      {key:'mensal' as Recurrence, label:'Mensal · 6×',  icon:'🗓️'},
                    ]).map(opt=>(
                      <button key={opt.key} onClick={()=>!editingEventId && setEvRecurrence(opt.key)} disabled={!!editingEventId} style={{
                        flex:1,padding:'9px 4px',borderRadius:11,border:'none',cursor:'pointer',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                        background:evRecurrence===opt.key?'rgba(232,168,56,.12)':'var(--bg2)',
                        outline:evRecurrence===opt.key?'1.5px solid var(--gold)':'0.5px solid var(--border)',
                        transition:'all .15s', opacity: editingEventId ? 0.5 : 1,
                      }}>
                        <span style={{fontSize:16}}>{opt.icon}</span>
                        <span style={{fontSize:9,fontFamily:'Syne, sans-serif',fontWeight:evRecurrence===opt.key?700:400,color:evRecurrence===opt.key?'var(--gold)':'var(--text3)',textAlign:'center'}}>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Cor</label>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    {EVENT_COLORS.map(c=>(
                      <button key={c} onClick={()=>setEvColor(c)} style={{width:28,height:28,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:evColor===c?'2.5px solid white':'none'}}/>
                    ))}
                  </div>
                </div>
                <div style={{padding:'12px 24px 48px',background:'var(--bg1)',borderTop:'0.5px solid var(--border)'}}>
                  <button onClick={saveEv} disabled={evSaving||!evTitle.trim()} style={{width:'100%',background:evTitle.trim()?'var(--gold)':'var(--bg3)',color:evTitle.trim()?'var(--bg0)':'var(--text3)',border:'none',borderRadius:14,padding:14,fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                    {evSaving ? 'A guardar…' : editingEventId ? 'Guardar alterações' : evRecurrence==='semanal' ? 'Criar 12 semanas' : evRecurrence==='mensal' ? 'Criar 6 meses' : 'Guardar evento'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Nav />
    </main>
  )
}
