'use client'

import { useCallback, useEffect, useState } from 'react'
import { addDays, addMonths, addWeeks, endOfWeek, format, getDay, isSameMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'
import {
  supabase,
  getCalendarData,
  getCheckinsForDate,
  getReminders,
  saveReminder,
  toggleReminder,
  deleteReminder,
  getAgendaEvents,
  saveAgendaEvent,
  deleteAgendaEvent,
  getHabitsWithLogs,
  toggleHabitLog,
  saveCheckin,
  updateStreak,
  AGENDA_COLUMNS,
} from '@/lib/supabase'
import { todayISO, parseLocalDate } from '@/lib/date'
import {
  computeCurrentStreak,
  getPatternInsights,
  PHASE_LABELS,
  type AgendaEvent,
  type Checkin,
  type DayStatus,
  type HabitRow,
  type Recurrence,
  type Reminder,
  type ViewMode,
  type WeekdayStat,
} from '@/components/calendario/types'

export function useCalendarioController() {
  const [userId, setUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [dayMap, setDayMap] = useState<Record<string, DayStatus>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [selCheckins, setSelCheckins] = useState<Checkin[]>([])
  const [selEvents, setSelEvents] = useState<AgendaEvent[]>([])
  const [selHabits, setSelHabits] = useState<HabitRow[]>([])
  const [panelLoad, setPanelLoad] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [todayCI, setTodayCI] = useState<Checkin[]>([])
  const [toast, setToast] = useState('')
  const [quickPhase, setQuickPhase] = useState<string | null>(null)
  const [quickEnergy, setQuickEnergy] = useState(7)
  const [quickMission, setQuickMission] = useState('')
  const [quickWin, setQuickWin] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [patterns, setPatterns] = useState<WeekdayStat[]>([])
  const [patternsLoaded, setPatternsLoaded] = useState(false)
  const [showRmForm, setShowRmForm] = useState(false)
  const [rmTitle, setRmTitle] = useState('')
  const [rmTime, setRmTime] = useState('08:00')
  const [rmDays, setRmDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [rmType, setRmType] = useState('custom')
  const [rmSaving, setRmSaving] = useState(false)
  const [showEvForm, setShowEvForm] = useState(false)
  const [evTitle, setEvTitle] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [evDate, setEvDate] = useState(todayISO())
  const [evTime, setEvTime] = useState('')
  const [evEndTime, setEvEndTime] = useState('')
  const [evColor, setEvColor] = useState('#E8A838')
  const [evAllDay, setEvAllDay] = useState(false)
  const [evRecurrence, setEvRecurrence] = useState<Recurrence>('none')
  const [evSaving, setEvSaving] = useState(false)
  const today = todayISO()

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2800)
  }

  const loadMonth = useCallback(async (uid: string, date: Date) => {
    const [calData, monthEvents] = await Promise.all([
      getCalendarData(uid, date.getFullYear(), date.getMonth() + 1),
      getAgendaEvents(uid, date.getFullYear(), date.getMonth() + 1),
    ])
    setEvents(monthEvents)
    const map: Record<string, DayStatus> = {}
    ;(calData.logs as { date: string; completed: boolean }[]).forEach(log => {
      if (!map[log.date]) map[log.date] = { habits: 0, total: 0, checkins: 0, complete: false }
      map[log.date].total++
      if (log.completed) map[log.date].habits++
    })
    ;(calData.checkins as { date: string }[]).forEach(checkin => {
      if (!map[checkin.date]) map[checkin.date] = { habits: 0, total: 0, checkins: 0, complete: false }
      map[checkin.date].checkins++
    })
    Object.values(map).forEach(day => { day.complete = day.checkins >= 2 && day.habits >= 1 })
    setDayMap(map)
  }, [])

  const loadPatterns = useCallback(async (uid: string) => {
    const now = new Date()
    const previousMonth = subMonths(now, 1)
    const twoMonthsAgo = subMonths(now, 2)
    const [currentMonth, month1, month2] = await Promise.all([
      getCalendarData(uid, now.getFullYear(), now.getMonth() + 1),
      getCalendarData(uid, previousMonth.getFullYear(), previousMonth.getMonth() + 1),
      getCalendarData(uid, twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth() + 1),
    ])
    const byDate: Record<string, { done: number; total: number }> = {}
    ;[...(currentMonth.logs as { date: string; completed: boolean }[]), ...(month1.logs as { date: string; completed: boolean }[]), ...(month2.logs as { date: string; completed: boolean }[])].forEach(log => {
      if (!byDate[log.date]) byDate[log.date] = { done: 0, total: 0 }
      byDate[log.date].total++
      if (log.completed) byDate[log.date].done++
    })
    const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, done: 0, total: 0 }))
    Object.entries(byDate).forEach(([dateStr, stat]) => {
      if (dateStr > today) return
      const weekday = getDay(parseLocalDate(dateStr))
      stats[weekday].done += stat.done > 0 ? 1 : 0
      stats[weekday].total += 1
    })
    setPatterns(stats)
    setPatternsLoaded(true)
  }, [today])

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    setLoading(true)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      if (cancelled) return
      setUserId(user.id)
      await Promise.all([
        loadMonth(user.id, new Date()),
        getReminders(user.id).then(data => setReminders(data as Reminder[])),
        getCheckinsForDate(user.id, today).then(data => setTodayCI(data as Checkin[])),
      ])
      if (cancelled) return
      setLoading(false)
      loadPatterns(user.id)
    }).catch((err) => {
      if (cancelled) return
      console.error('[calendario] falha ao carregar dados:', err)
      setLoadError(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [today, loadMonth, loadPatterns, retryKey])

  async function changeMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(current, 1) : subMonths(current, 1)
    setCurrent(next)
    if (userId) await loadMonth(userId, next)
  }

  function changeWeek(dir: 1 | -1) {
    const next = dir === 1 ? addWeeks(weekStart, 1) : subWeeks(weekStart, 1)
    setWeekStart(next)
    const weekEnd = endOfWeek(next, { weekStartsOn: 1 })
    if (userId && !isSameMonth(next, current)) { setCurrent(next); loadMonth(userId, next) }
    else if (userId && !isSameMonth(weekEnd, current)) loadMonth(userId, next)
  }

  async function selectDay(dateStr: string) {
    if (selected === dateStr) { setSelected(null); return }
    setSelected(dateStr)
    setQuickPhase(null)
    if (!userId) return
    setPanelLoad(true)
    const [checkins, dayEvents, habits] = await Promise.all([
      getCheckinsForDate(userId, dateStr),
      supabase.from('agenda_events').select(AGENDA_COLUMNS).eq('user_id', userId).eq('date', dateStr).order('time'),
      getHabitsWithLogs(userId, dateStr),
    ])
    setSelCheckins(checkins as Checkin[])
    setSelEvents((dayEvents.data ?? []) as AgendaEvent[])
    setSelHabits(habits as HabitRow[])
    setPanelLoad(false)
  }

  async function toggleRetroHabit(habitId: string, currentDone: boolean, dateStr: string) {
    if (!userId) return
    await toggleHabitLog(userId, habitId, dateStr, !currentDone)
    setSelHabits(await getHabitsWithLogs(userId, dateStr) as HabitRow[])
    loadMonth(userId, current)
    showToast(currentDone ? 'Desmarcado' : 'Marcado ✓')
  }

  async function doQuickCheckin() {
    if (!userId || !quickPhase || !selected) return
    setQuickSaving(true)
    await saveCheckin({ user_id: userId, date: selected, phase: quickPhase, energy: quickEnergy, mission: quickPhase === 'manha' ? (quickMission.trim() || null) : null, win_of_day: quickPhase === 'noite' ? (quickWin.trim() || null) : null, completed_at: new Date().toISOString() })
    await updateStreak(userId)
    const checkins = await getCheckinsForDate(userId, selected)
    setSelCheckins(checkins as Checkin[])
    if (selected === today) setTodayCI(checkins as Checkin[])
    await loadMonth(userId, current)
    setQuickPhase(null); setQuickEnergy(7); setQuickMission(''); setQuickWin('')
    setQuickSaving(false)
    showToast(`Check-in da ${PHASE_LABELS[quickPhase]} guardado!`)
  }

  async function saveRm() {
    if (!userId || !rmTitle.trim()) return
    setRmSaving(true)
    await saveReminder({ user_id: userId, title: rmTitle, time: rmTime, days: rmDays, type: rmType, active: true })
    setReminders(await getReminders(userId) as Reminder[])
    setShowRmForm(false); setRmTitle(''); setRmDays([1, 2, 3, 4, 5])
    showToast('Lembrete criado!')
    setRmSaving(false)
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
    setReminders(prev => prev.filter(reminder => reminder.id !== id))
    showToast('Lembrete removido!')
  }

  async function saveEv() {
    const authUserId = userId || (await supabase.auth.getUser()).data.user?.id || null
    if (!authUserId || !evTitle.trim()) return
    setEvSaving(true)
    const baseDate = parseLocalDate(evDate)
    const dates: string[] = [evDate]
    if (evRecurrence === 'diario') for (let i = 1; i < 14; i++) dates.push(format(addDays(baseDate, i), 'yyyy-MM-dd'))
    if (evRecurrence === 'semanal') for (let i = 1; i < 12; i++) dates.push(format(addWeeks(baseDate, i), 'yyyy-MM-dd'))
    if (evRecurrence === 'mensal') for (let i = 1; i < 6; i++) dates.push(format(addMonths(baseDate, i), 'yyyy-MM-dd'))
    const results = await Promise.all(dates.map(dateStr => saveAgendaEvent({ user_id: authUserId, title: evTitle, description: evDesc || null, date: dateStr, time: evTime || null, end_time: evEndTime || null, color: evColor, all_day: evAllDay })))
    const failed = results.find(result => result.error)
    if (failed?.error) { showToast(`Erro ao guardar evento: ${failed.error.message}`); setEvSaving(false); return }
    await loadMonth(authUserId, current)
    setShowEvForm(false); setEvTitle(''); setEvDesc(''); setEvTime(''); setEvEndTime(''); setEvRecurrence('none')
    showToast(evRecurrence === 'diario' ? '14 dias criados!' : evRecurrence === 'semanal' ? '12 semanas criadas!' : evRecurrence === 'mensal' ? '6 meses criados!' : 'Evento adicionado!')
    setEvSaving(false)
  }

  async function removeEvent(id: string) {
    if (!userId) return
    const { error } = await deleteAgendaEvent(id, userId)
    if (error) { showToast(`Erro ao remover: ${error.message}`); return }
    setEvents(prev => prev.filter(event => event.id !== id))
    setSelEvents(prev => prev.filter(event => event.id !== id))
    showToast('Evento removido!')
  }

  const insights = patternsLoaded ? getPatternInsights(patterns) : []

  return {
    loading, loadError, retryLoad: () => setRetryKey((k) => k + 1), toast, today, insights,
    // grelha
    viewMode, setViewMode, current, weekStart, dayMap, events, selected,
    currentStreak: computeCurrentStreak(dayMap),
    changeMonth, changeWeek, selectDay,
    closeDay: () => setSelected(null),
    // detalhe do dia
    selCheckins, selEvents, selHabits, panelLoad,
    quickPhase, setQuickPhase, quickEnergy, setQuickEnergy,
    quickMission, setQuickMission, quickWin, setQuickWin,
    quickSaving, doQuickCheckin, toggleRetroHabit, removeEvent,
    // check-ins de hoje
    todayCI,
    // alertas (lembretes)
    reminders, rmTitle, setRmTitle, rmTime, setRmTime, rmDays, setRmDays, rmSaving,
    saveRm, toggleRm, removeRm,
    // eventos
    evTitle, setEvTitle, evDesc, setEvDesc, evDate, setEvDate, evTime, setEvTime,
    evEndTime, setEvEndTime, evColor, setEvColor, evAllDay, setEvAllDay,
    evRecurrence, setEvRecurrence, evSaving, saveEv,
  }
}
