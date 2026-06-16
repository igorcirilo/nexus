// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { format, endOfMonth } from 'date-fns'
import type { HabitArea, WeeklyLeagueOverview, WeeklyLeagueStanding, ReaderMode, ReaderTheme } from '@/types'
import { emitToast } from '@/lib/toast-events'
import { computeRitmo, RITMO_WINDOW_DAYS, type RitmoDay } from '@/lib/ritmo'

// NEXT_PUBLIC_* values are inlined at build time. During build/CI (and any
// environment without them set) they are undefined, which makes createClient
// throw "supabaseUrl is required" and breaks static prerendering. Fall back to
// safe placeholders so the bundle builds; the real values are provided via env
// at deploy time (e.g. Vercel) and inlined into the client bundle.
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnon)

function reportError(context: string, message: string) {
  console.error(`[${context}]`, message || 'erro desconhecido')
  emitToast(`Erro: ${context.replace(' error', '').replace(/([A-Z])/g, ' $1').trim()}`, 'error')
}

// ── Perfil ─────────────────────────────────────────────────
export async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { data } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return data
}

// ── Hábitos ────────────────────────────────────────────────
export async function getHabitsWithLogs(userId: string, date: string) {
  const { data: habits } = await supabase
    .from('habits')
    .select('*, habit_logs(completed, date)')
    .eq('user_id', userId)
    .eq('active', true)
    .eq('habit_logs.date', date)
  return habits ?? []
}

export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date: string,
  completed: boolean,
) {
  return supabase.from('habit_logs').upsert(
    { user_id: userId, habit_id: habitId, date, completed,
      completed_at: completed ? new Date().toISOString() : null },
    { onConflict: 'user_id,habit_id,date' },
  )
}

// ── Check-ins ──────────────────────────────────────────────
export async function getCheckinsForDate(userId: string, date: string) {
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
  return data ?? []
}

export async function saveCheckin(payload: Record<string, unknown>) {
  return supabase.from('checkins').upsert(payload, {
    onConflict: 'user_id,date,phase',
  })
}

// ── Ofensiva & Ritmo ───────────────────────────────────────
// Atualiza a ofensiva diária. O RPC recalcula também o nível/título a partir
// do melhor streak (recompute_level), por isso não há mais concessão de XP.
export async function updateStreak(userId: string) {
  return supabase.rpc('update_streak', { p_user_id: userId })
}

/**
 * Calcula o Ritmo (0–100) do utilizador a partir dos últimos dias de hábitos
 * e check-ins. Reusa o padrão de janela de `getWeeklyStats`.
 */
export async function getRitmo(userId: string): Promise<number> {
  const days = RITMO_WINDOW_DAYS
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = since.toISOString().split('T')[0]

  const [{ data: habits }, { data: logs }, { data: checkins }] = await Promise.all([
    supabase.from('habits').select('id').eq('user_id', userId).eq('active', true),
    supabase.from('habit_logs').select('date').eq('user_id', userId).eq('completed', true).gte('date', sinceStr),
    supabase.from('checkins').select('date').eq('user_id', userId).gte('date', sinceStr),
  ])

  const habitsTotal = (habits ?? []).length
  const doneByDay: Record<string, number> = {}
  for (const l of (logs ?? []) as { date: string }[]) {
    doneByDay[l.date] = (doneByDay[l.date] ?? 0) + 1
  }
  const checkinDays = new Set((checkins ?? []).map((c: { date: string }) => c.date))

  const arr: RitmoDay[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    arr.push({ habitsTotal, habitsDone: doneByDay[ds] ?? 0, checkin: checkinDays.has(ds) })
  }
  return computeRitmo(arr)
}

// ── Sessões de foco ────────────────────────────────────────
export async function saveFocusSession(
  userId: string, duration: number, task?: string,
) {
  return supabase.from('focus_sessions').insert({
    user_id: userId, duration, task,
    date: new Date().toISOString().split('T')[0],
  })
}

// ── Objectivos 90 dias ─────────────────────────────────────
export async function getGoals90(userId: string) {
  const { data } = await supabase
    .from('goals_90')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at')
  return data ?? []
}

// ── Badges ─────────────────────────────────────────────────
export async function getUserBadges(userId: string) {
  const { data } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
  return data ?? []
}

export async function awardBadge(userId: string, badgeKey: string) {
  return supabase
    .from('user_badges')
    .upsert({ user_id: userId, badge_key: badgeKey }, { onConflict: 'user_id,badge_key' })
}

// ── Dashboard: últimos 7 dias ──────────────────────────────
export async function getWeeklyStats(userId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 6)
  const sinceStr = since.toISOString().split('T')[0]

  const [{ data: logs }, { data: checkins }, { data: sessions }] = await Promise.all([
    supabase.from('habit_logs')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', sinceStr),
    supabase.from('checkins')
      .select('date, energy, sleep_hours, mood')
      .eq('user_id', userId)
      .gte('date', sinceStr),
    supabase.from('focus_sessions')
      .select('date, duration')
      .eq('user_id', userId)
      .gte('date', sinceStr),
  ])

  return { logs: logs ?? [], checkins: checkins ?? [], sessions: sessions ?? [] }
}

// ── Perfil expandido ───────────────────────────────────────
export async function updateFullProfile(userId: string, updates: Record<string, unknown>) {
  return supabase.from('profiles').update(updates).eq('id', userId)
}

// ── Lembretes ──────────────────────────────────────────────
export async function getReminders(userId: string) {
  const { data } = await supabase
    .from('reminders')
    .select('id, title, time, days, active, type')
    .eq('user_id', userId)
    .order('time')
  return data ?? []
}

export async function saveReminder(payload: Record<string, unknown>) {
  if (payload.id) {
    const { id, ...rest } = payload
    return supabase.from('reminders').update(rest).eq('id', id)
  }
  return supabase.from('reminders').insert(payload)
}

export async function deleteReminder(id: string) {
  return supabase.from('reminders').delete().eq('id', id)
}

export async function toggleReminder(id: string, active: boolean) {
  return supabase.from('reminders').update({ active }).eq('id', id)
}

// ── Calendário: dias concluídos ────────────────────────────
export async function getCalendarData(userId: string, year: number, month: number) {
  const start   = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate() // último dia real do mês
  const end     = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
  const [{ data: logs }, { data: checkins }] = await Promise.all([
    supabase.from('habit_logs')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', start).lte('date', end),
    supabase.from('checkins')
      .select('date, phase')
      .eq('user_id', userId)
      .gte('date', start).lte('date', end),
  ])
  return { logs: logs ?? [], checkins: checkins ?? [] }
}

// ── Desafio semanal dinâmico ───────────────────────────────
export async function getDynamicWeeklyChallenge(userId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 13)
  const sinceStr = since.toISOString().split('T')[0]

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('id, area, name').eq('user_id', userId).eq('active', true),
    supabase.from('habit_logs').select('habit_id, completed, date')
      .eq('user_id', userId).gte('date', sinceStr),
  ])

  if (!habits || habits.length === 0) {
    return { title: 'Semana da Consistência', area: 'corpo', done: 0, total: 7 }
  }

  const areaMap: Record<string, { ids: string[]; done: number; total: number }> = {}
  for (const h of habits as { id: string; area: string }[]) {
    if (!areaMap[h.area]) areaMap[h.area] = { ids: [], done: 0, total: 0 }
    areaMap[h.area].ids.push(h.id)
  }

  for (const log of logs as { habit_id: string; completed: boolean }[]) {
    for (const [, data] of Object.entries(areaMap)) {
      if (data.ids.includes(log.habit_id)) {
        data.total++
        if (log.completed) data.done++
      }
    }
  }

  let worstArea = 'corpo'
  let worstPct  = 100
  for (const [area, data] of Object.entries(areaMap)) {
    const pct = data.total > 0 ? data.done / data.total : 0
    if (pct < worstPct) { worstPct = pct; worstArea = area }
  }

  const AREA_NAMES: Record<string, string> = {
    corpo: 'Saúde & Corpo', produtividade: 'Foco Total',
    carreira: 'Desenvolvimento', financas: 'Finanças',
    idiomas: 'Idiomas', emocoes: 'Equilíbrio', relacionamentos: 'Relações',
  }

  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay())
  const weekStr  = thisWeek.toISOString().split('T')[0]
  const weekLogs = (logs as { habit_id: string; completed: boolean; date: string }[])
    .filter(l => l.date >= weekStr && areaMap[worstArea]?.ids.includes(l.habit_id) && l.completed)
  const doneDays = new Set(weekLogs.map(l => l.date)).size

  return {
    title: `Semana de ${AREA_NAMES[worstArea] ?? worstArea}`,
    area: worstArea,
    done: doneDays,
    total: 7,
  }
}

// ── Objectivos 90 dias ─────────────────────────────────────
export async function saveGoal90(payload: Record<string, unknown>) {
  if (payload.id) {
    const { id, ...rest } = payload
    return supabase.from('goals_90').update(rest).eq('id', id)
  }
  return supabase.from('goals_90').insert(payload)
}

export async function deleteGoal90(id: string) {
  return supabase.from('goals_90').delete().eq('id', id)
}

export async function getMilestones(goalId: string) {
  const { data } = await supabase
    .from('goal_milestones')
    .select('*')
    .eq('goal_id', goalId)
    .order('due_date')
  return data ?? []
}

export async function saveMilestone(payload: Record<string, unknown>) {
  if (payload.id) {
    const { id, ...rest } = payload
    return supabase.from('goal_milestones').update(rest).eq('id', id)
  }
  return supabase.from('goal_milestones').insert(payload)
}

export async function toggleMilestone(id: string, done: boolean) {
  return supabase.from('goal_milestones').update({ done }).eq('id', id)
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── Agenda ─────────────────────────────────────────────────
export type AgendaEvent = {
  id: string
  user_id: string
  title: string
  description: string | null
  date: string
  time: string | null
  end_time: string | null
  color: string
  all_day: boolean
  created_at: string
}

// Colunas explícitas — evita select('*') e o overfetch de payload.
export const AGENDA_COLUMNS = 'id, user_id, title, description, date, time, end_time, color, all_day, created_at'

export async function getAgendaEvents(userId: string, year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const start = format(firstDay, 'yyyy-MM-dd')
  const end = format(endOfMonth(firstDay), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('agenda_events')
    .select(AGENDA_COLUMNS)
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('time')

  if (error) {
    reportError('getAgendaEvents error', error.message)
    return []
  }

  return (data ?? []) as AgendaEvent[]
}

export async function saveAgendaEvent(payload: Partial<AgendaEvent> & { user_id: string }) {
  if (payload.id) {
    const { id, ...rest } = payload
    const { data, error } = await supabase
      .from('agenda_events')
      .update(rest)
      .eq('id', id)
      .eq('user_id', payload.user_id)
      .select()
      .single()

    if (error) reportError('saveAgendaEvent update error', error.message)
    return { data: data as AgendaEvent | null, error }
  }

  const { data, error } = await supabase
    .from('agenda_events')
    .insert({
      user_id: payload.user_id,
      title: payload.title?.trim() ?? '',
      description: payload.description ?? null,
      date: payload.date,
      time: payload.all_day ? null : payload.time ?? null,
      end_time: payload.all_day ? null : payload.end_time ?? null,
      color: payload.color ?? '#E8A838',
      all_day: payload.all_day ?? false,
    })
    .select()
    .single()

  if (error) reportError('saveAgendaEvent insert error', error.message)
  return { data: data as AgendaEvent | null, error }
}

export async function deleteAgendaEvent(id: string, userId?: string) {
  let query = supabase.from('agenda_events').delete().eq('id', id)
  if (userId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) reportError('deleteAgendaEvent error', error.message)
  return { error }
}

// ── Transacções financeiras ─────────────────────────────────
export async function getTransactions(userId: string, months = 1) {
  const since = new Date()
  since.setMonth(since.getMonth() - months + 1)
  since.setDate(1)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceStr)
    .order('date', { ascending: false })

  if (error) {
    reportError('getTransactions error', error.message)
    return []
  }
  return data ?? []
}

export async function getTransactionsByMonth(userId: string, numMonths = 6) {
  const since = new Date()
  since.setMonth(since.getMonth() - numMonths + 1)
  since.setDate(1)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('transactions')
    .select('date, type, amount, category')
    .eq('user_id', userId)
    .gte('date', sinceStr)
    .order('date', { ascending: true })

  if (error) {
    reportError('getTransactionsByMonth error', error.message)
    return []
  }
  return data ?? []
}

export async function saveTransaction(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single()
  if (error) reportError('saveTransaction error', error.message)
  return { data, error }
}

export async function saveTransactionsBulk(payloads: Record<string, unknown>[]) {
  if (!payloads.length) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(payloads)
    .select()

  if (error) reportError('saveTransactionsBulk error', error.message)
  return { data: data ?? [], error }
}

export async function updateTransaction(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) reportError('updateTransaction error', error.message)
  return { data, error }
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) reportError('deleteTransaction error', error.message)
  return { error }
}

export async function updateFinancialGoals(
  userId: string,
  goals: { fin_monthly_save?: number; fin_reserve_goal?: number; fin_current_savings?: number }
) {
  return supabase.from('profiles').update(goals).eq('id', userId)
}



// ── Corpo ───────────────────────────────────────────────────
export async function getTrainingPlans(userId: string) {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    reportError('getTrainingPlans error', error.message)
    return []
  }

  return data ?? []
}

export async function saveTrainingPlan(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('training_plans')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveTrainingPlan error', error.message)
  return { data, error }
}

export async function getDietPlans(userId: string) {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    reportError('getDietPlans error', error.message)
    return []
  }

  return data ?? []
}

export async function saveDietPlan(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('diet_plans')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveDietPlan error', error.message)
  return { data, error }
}


// ── Leitura ────────────────────────────────────────────────
export async function getBooks(userId: string) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    reportError('getBooks error', error.message)
    return []
  }

  return data ?? []
}

export async function getBookById(bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .eq('user_id', userId)
    .single()

  if (error) {
    reportError('getBookById error', error.message)
    return null
  }

  return data
}

export async function saveBook(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('books')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveBook error', error.message)
  return { data, error }
}

export async function getBookProgress(bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('book_progress')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    reportError('getBookProgress error', error.message)
  }

  return data ?? null
}

export async function saveBookProgress(payload: { user_id: string; book_id: string; current_page: number; progress_pct: number }) {
  const { data, error } = await supabase
    .from('book_progress')
    .upsert(payload, { onConflict: 'user_id,book_id' })
    .select()
    .single()

  if (error) reportError('saveBookProgress error', error.message)
  return { data, error }
}

export async function getBookHighlights(bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('book_highlights')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .order('page', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    reportError('getBookHighlights error', error.message)
    return []
  }

  return data ?? []
}

export async function saveBookHighlight(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('book_highlights')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveBookHighlight error', error.message)
  return { data, error }
}

export async function deleteBookHighlight(id: string, userId: string) {
  const { error } = await supabase.from('book_highlights').delete().eq('id', id).eq('user_id', userId)
  if (error) reportError('deleteBookHighlight error', error.message)
  return { error }
}

export async function getBookNotes(bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('book_notes')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .order('page', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    reportError('getBookNotes error', error.message)
    return []
  }

  return data ?? []
}

export async function saveBookNote(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('book_notes')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveBookNote error', error.message)
  return { data, error }
}

export async function deleteBookNote(id: string, userId: string) {
  const { error } = await supabase.from('book_notes').delete().eq('id', id).eq('user_id', userId)
  if (error) reportError('deleteBookNote error', error.message)
  return { error }
}

export async function getBookBookmarks(bookId: string, userId: string) {
  const { data, error } = await supabase
    .from('book_bookmarks')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .order('page', { ascending: true })

  if (error) {
    reportError('getBookBookmarks error', error.message)
    return []
  }

  return data ?? []
}

export async function saveBookBookmark(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('book_bookmarks')
    .insert(payload)
    .select()
    .single()

  if (error) reportError('saveBookBookmark error', error.message)
  return { data, error }
}

export async function deleteBookBookmark(id: string, userId: string) {
  const { error } = await supabase.from('book_bookmarks').delete().eq('id', id).eq('user_id', userId)
  if (error) reportError('deleteBookBookmark error', error.message)
  return { error }
}

export async function getReadingPreference(userId: string) {
  const { data, error } = await supabase
    .from('reading_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    reportError('getReadingPreference error', error.message)
  }

  return data ?? null
}

export async function saveReadingPreference(payload: {
  user_id: string
  theme: ReaderTheme
  reading_mode: ReaderMode
  font_scale: number
  line_height: number
  margin_px: number
}) {
  const { data, error } = await supabase
    .from('reading_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) reportError('saveReadingPreference error', error.message)
  return { data, error }
}

// ── Badges automáticos ─────────────────────────────────────
const BADGE_NAMES: Record<string, string> = {
  primeiro_checkin: 'Primeira Vez',
  streak_7: 'Uma Semana',
  streak_21: 'Três Semanas',
  streak_100: 'Centenário',
  ritmo_80: 'Em Chamas',
  consistencia_30: 'Inabalável',
}

export async function checkAndAwardBadges(
  userId: string,
  profile: { streak_current: number; streak_best: number; ritmo: number },
) {
  const { data: existing } = await supabase
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', userId)

  const earned = new Set((existing ?? []).map((b: { badge_key: string }) => b.badge_key))
  const { data: firstCheckin } = await supabase
    .from('checkins')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const toAward: string[] = []
  if (firstCheckin && !earned.has('primeiro_checkin')) toAward.push('primeiro_checkin')
  if (profile.streak_current >= 7 && !earned.has('streak_7')) toAward.push('streak_7')
  if (profile.streak_current >= 21 && !earned.has('streak_21')) toAward.push('streak_21')
  if (profile.streak_current >= 100 && !earned.has('streak_100')) toAward.push('streak_100')
  if (profile.ritmo >= 80 && !earned.has('ritmo_80')) toAward.push('ritmo_80')
  if (profile.streak_best >= 30 && !earned.has('consistencia_30')) toAward.push('consistencia_30')

  for (const key of toAward) {
    await awardBadge(userId, key)
  }

  return toAward.map((key) => ({ key, name: BADGE_NAMES[key] ?? key }))
}

// ── Bónus de login diário ──────────────────────────────────
export async function claimLoginBonus(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]

  const { data: prof } = await supabase
    .from('profiles')
    .select('last_login_bonus')
    .eq('id', userId)
    .single()

  if (!prof || prof.last_login_bonus === today) return false

  await supabase
    .from('profiles')
    .update({ last_login_bonus: today })
    .eq('id', userId)

  // Sem bónus de XP: o login apenas marca presença do dia.
  return true
}

// ── Liga semanal de consistência ───────────────────────────
// Conta os compromissos cumpridos desde a última segunda-feira (check-ins,
// hábitos completos, sessões de foco e tarefas de programa). É um inteiro
// objetivo e não inflável — substitui o XP semanal.
export async function getWeeklyConsistencyPoints(userId: string): Promise<number> {
  const now = new Date()
  const day = now.getDay() // 0=dom, 1=seg...
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().split('T')[0]
  const mondayIso = monday.toISOString()

  const [checkins, habits, focus, tasks] = await Promise.all([
    supabase.from('checkins').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('date', mondayStr),
    supabase.from('habit_logs').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('completed', true).gte('date', mondayStr),
    supabase.from('focus_sessions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('date', mondayStr),
    supabase.from('program_tasks').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'completed').gte('completed_at', mondayIso),
  ])

  return (checkins.count ?? 0) + (habits.count ?? 0) + (focus.count ?? 0) + (tasks.count ?? 0)
}


// ── Quick actions ───────────────────────────────────────────
export async function createHabitQuick(payload: {
  user_id: string
  name: string
  area: HabitArea
  time_window?: string | null
}) {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      area: payload.area,
      time_window: payload.time_window?.trim() || null,
      active: true,
    })
    .select()
    .single()

  if (error) reportError('createHabitQuick error', error.message)
  return { data, error }
}

function getWeekWindow(base = new Date()) {
  const now = new Date(base)
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(sunday)
  prevSunday.setDate(sunday.getDate() - 7)

  const toDate = (d: Date) => d.toISOString().split('T')[0]
  return {
    weekStart: toDate(monday),
    weekEnd: toDate(sunday),
    prevWeekStart: toDate(prevMonday),
    prevWeekEnd: toDate(prevSunday),
  }
}

function getLeagueTier(points: number): WeeklyLeagueStanding['tier'] {
  if (points >= 60) return 'Lenda'
  if (points >= 35) return 'Ouro'
  if (points >= 15) return 'Prata'
  return 'Bronze'
}

export async function ensureWeeklyLeagueSnapshot(userId: string) {
  const { weekStart, weekEnd } = getWeekWindow()
  const points = await getWeeklyConsistencyPoints(userId)
  const tier = getLeagueTier(points)

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, level, title')
    .eq('id', userId)
    .single()

  const { data, error } = await supabase
    .from('weekly_league_snapshots')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      points,
      tier,
      username: profile?.username ?? 'Guerreiro',
      level: profile?.level ?? 1,
      title: profile?.title ?? 'Recruta',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    .select()
    .single()

  if (error) {
    reportError('ensureWeeklyLeagueSnapshot error', error.message)
    return { data: null, error }
  }

  return { data, error: null }
}

export async function getWeeklyLeagueOverview(userId: string): Promise<WeeklyLeagueOverview | null> {
  const { weekStart, weekEnd, prevWeekStart } = getWeekWindow()

  const snapshot = await ensureWeeklyLeagueSnapshot(userId)
  if (snapshot.error) return null

  const { data: rows, error } = await supabase
    .from('weekly_league_snapshots')
    .select('user_id, week_start, week_end, points, tier, username, level, title, updated_at')
    .eq('week_start', weekStart)
    .order('points', { ascending: false })
    .order('updated_at', { ascending: true })

  if (error) {
    reportError('getWeeklyLeagueOverview current error', error.message)
    return null
  }

  const standings = (rows ?? []).map((row, index) => ({
    user_id: row.user_id as string,
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    points: row.points as number,
    tier: row.tier as WeeklyLeagueStanding['tier'],
    username: (row.username as string | null) ?? 'Guerreiro',
    level: (row.level as number | null) ?? 1,
    title: (row.title as string | null) ?? 'Recruta',
    updated_at: row.updated_at as string | undefined,
    rank: index + 1,
  }))

  const me = standings.find(row => row.user_id === userId) ?? null

  const { data: previousRows } = await supabase
    .from('weekly_league_snapshots')
    .select('user_id, week_start, week_end, points, tier, username, level, title, updated_at')
    .eq('week_start', prevWeekStart)
    .order('points', { ascending: false })
    .order('updated_at', { ascending: true })

  const previousStandings = (previousRows ?? []).map((row, index) => ({
    user_id: row.user_id as string,
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    points: row.points as number,
    tier: row.tier as WeeklyLeagueStanding['tier'],
    username: (row.username as string | null) ?? 'Guerreiro',
    level: (row.level as number | null) ?? 1,
    title: (row.title as string | null) ?? 'Recruta',
    updated_at: row.updated_at as string | undefined,
    rank: index + 1,
  }))
  const previousMe = previousStandings.find(row => row.user_id === userId) ?? null

  const { data: historyRows } = await supabase
    .from('weekly_league_snapshots')
    .select('week_start, week_end, points, tier')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(4)

  return {
    week_start: weekStart,
    week_end: weekEnd,
    total_players: standings.length,
    top: standings.slice(0, 5),
    me,
    previous_rank: previousMe?.rank ?? null,
    previous_points: previousMe?.points ?? null,
    history: (historyRows ?? []).map(row => ({
      week_start: row.week_start as string,
      week_end: row.week_end as string,
      points: row.points as number,
      tier: row.tier as WeeklyLeagueStanding['tier'],
      rank: row.week_start === weekStart ? me?.rank ?? null : previousRows
        ? previousStandings.find(item => item.user_id === userId && item.week_start === row.week_start)?.rank ?? null
        : null,
    })),
  }
}

// ── Streak Recovery (freeze semanal) ───────────────────────

/** Semana ISO no formato YYYY-Www (ex: 2026-W15) usando algoritmo ISO 8601 correto */
function currentISOWeek(): string {
  const now = new Date()
  const thursday = new Date(now)
  thursday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 3) // quinta-feira desta semana ISO
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3)
  const week = Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) + 1
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Verifica se o utilizador pode usar o streak freeze.
 * Condições: streak atual = 0, streak_best > 0,
 *            último log de hábito foi ontem ou hoje,
 *            freeze ainda não usado esta semana.
 */
export async function canClaimStreakRecovery(userId: string): Promise<boolean> {
  const { data: prof } = await supabase
    .from('profiles')
    .select('streak_current, streak_best, streak_freeze_used_week')
    .eq('id', userId)
    .single()

  if (!prof) return false
  const p = prof as typeof prof & { streak_freeze_used_week?: string | null }
  if (p.streak_current > 0) return false
  if (!p.streak_best || p.streak_best === 0) return false
  if (p.streak_freeze_used_week === currentISOWeek()) return false

  // Verificar se teve atividade nos últimos 2 dias
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 2)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', cutoffStr)
    .limit(1)

  return (logs ?? []).length > 0
}

/**
 * Aplica o streak freeze: restaura o streak para 1 e marca a semana como usada.
 */
export async function claimStreakRecovery(userId: string): Promise<boolean> {
  const canRecover = await canClaimStreakRecovery(userId)
  if (!canRecover) return false

  const { error } = await supabase
    .from('profiles')
    .update({
      streak_current: 1,
      streak_freeze_used_week: currentISOWeek(),
    } as Record<string, unknown>)
    .eq('id', userId)

  if (error) {
    reportError('claimStreakRecovery error', error.message)
    return false
  }
  return true
}

// ── Sessões de leitura ─────────────────────────────────────
export async function saveReadingSession(payload: {
  user_id: string
  book_id: string
  date: string
  duration_minutes: number
  pages_read: number
}) {
  const { error } = await supabase.from('reading_sessions').insert(payload)
  if (error) reportError('saveReadingSession error', error.message)
  return { error }
}

export async function getReadingSessionsThisWeek(userId: string) {
  const now         = new Date()
  const dayOfWeek   = now.getDay()
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday      = new Date(now)
  monday.setDate(now.getDate() - daysFromMon)
  const mondayStr   = monday.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('date, duration_minutes, pages_read')
    .eq('user_id', userId)
    .gte('date', mondayStr)
    .order('date', { ascending: true })

  if (error) reportError('getReadingSessionsThisWeek error', error.message)
  return (data ?? []) as Array<{ date: string; duration_minutes: number; pages_read: number }>
}

export async function getTrainingCount30d(userId: string): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('training_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', sinceStr)

  if (error) reportError('getTrainingCount30d error', error.message)
  return count ?? 0
}

export async function getReadingPages30d(userId: string): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('pages_read')
    .eq('user_id', userId)
    .gte('date', sinceStr)

  if (error) reportError('getReadingPages30d error', error.message)
  return (data ?? []).reduce((sum, r) => sum + (r.pages_read ?? 0), 0)
}
