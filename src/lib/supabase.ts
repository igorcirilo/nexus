// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { format, endOfMonth } from 'date-fns'
import type { HabitArea, ReaderMode, ReaderTheme } from '@/types'
import { todayISO } from '@/lib/date'
import { emitToast } from '@/lib/toast-events'
import { computeRitmo, buildRitmoDays, RITMO_WINDOW_DAYS } from '@/lib/ritmo'
import { isHabitDueOn } from '@/lib/habit-schedule'

// NEXT_PUBLIC_* values are inlined at build time. During build/CI (and any
// environment without them set) they are undefined, which makes createClient
// throw "supabaseUrl is required" and breaks static prerendering. Fall back to
// safe placeholders so the bundle builds; the real values are provided via env
// at deploy time (e.g. Vercel) and inlined into the client bundle.
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

// Client de browser do @supabase/ssr: persiste a sessão em COOKIES (não em
// localStorage), para que os Server Components/middleware consigam ler a sessão.
// Mantém a mesma API de query usada em todo o app.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnon)

function reportError(context: string, message: string) {
  console.error(`[${context}]`, message || 'erro desconhecido')
  emitToast(`Erro: ${context.replace(' error', '').replace(/([A-Z])/g, ' $1').trim()}`, 'error')
}

/**
 * Guarda de autenticação partilhado pelas páginas cliente: devolve o utilizador
 * autenticado ou, se não houver sessão, redireciona para /auth e devolve null.
 * Centraliza o padrão `getUser() + redirect` que estava duplicado em ~10 páginas.
 */
export async function requireUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/auth'
    return null
  }
  return user
}

// ── Perfil ─────────────────────────────────────────────────
// O parâmetro `client` permite reusar estas leituras nos Server Components
// (passando o client de servidor). Por omissão usa o client de browser.
export async function getProfile(userId: string, client: SupabaseClient = supabase) {
  const { data } = await client
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
export async function getHabitsWithLogs(userId: string, date: string, client: SupabaseClient = supabase) {
  const { data: habits } = await client
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
export async function getCheckinsForDate(userId: string, date: string, client: SupabaseClient = supabase) {
  const { data } = await client
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
 * e check-ins.
 */
export async function getRitmo(userId: string): Promise<number> {
  const days = RITMO_WINDOW_DAYS
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = format(since, 'yyyy-MM-dd')

  const [{ data: habits }, { data: logs }, { data: checkins }] = await Promise.all([
    supabase.from('habits').select('id, days').eq('user_id', userId).eq('active', true),
    supabase.from('habit_logs').select('date').eq('user_id', userId).eq('completed', true).gte('date', sinceStr),
    supabase.from('checkins').select('date').eq('user_id', userId).gte('date', sinceStr),
  ])

  const habitList = (habits ?? []) as { id: string; days: number[] | null }[]
  const doneByDay: Record<string, number> = {}
  for (const l of (logs ?? []) as { date: string }[]) {
    doneByDay[l.date] = (doneByDay[l.date] ?? 0) + 1
  }
  const checkinDays = new Set((checkins ?? []).map((c: { date: string }) => c.date))

  // Denominador por dia: só os hábitos devidos naquele dia da semana.
  const habitsDueOn = (date: Date) => habitList.filter((h) => isHabitDueOn(h.days, date)).length
  const arr = buildRitmoDays(new Date(), habitsDueOn, doneByDay, checkinDays)
  return computeRitmo(arr)
}

// ── Sessões de foco ────────────────────────────────────────
export async function saveFocusSession(
  userId: string, duration: number, task?: string,
) {
  return supabase.from('focus_sessions').insert({
    user_id: userId, duration, task,
    date: todayISO(),
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

/**
 * Busca os marcos de vários objetivos numa única query (evita o N+1 de uma
 * chamada por objetivo). Devolve um mapa goal_id → marcos, ordenados por data.
 */
export async function getMilestonesForGoals(goalIds: string[]) {
  const map: Record<string, Record<string, unknown>[]> = {}
  if (goalIds.length === 0) return map
  const { data } = await supabase
    .from('goal_milestones')
    .select('*')
    .in('goal_id', goalIds)
    .order('due_date')
  for (const row of (data ?? []) as { goal_id: string }[]) {
    ;(map[row.goal_id] ??= []).push(row)
  }
  return map
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
  const sinceStr = format(since, 'yyyy-MM-dd')

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
  const sinceStr = format(since, 'yyyy-MM-dd')

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

// Todas as transações do utilizador (sem filtro de data) — usado na exportação CSV.
export async function getAllTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, type, category, amount, description')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    reportError('getAllTransactions error', error.message)
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

// ── Recorrentes (receitas/despesas mensais) ─────────────────
// Requer a migração supabase/financas_recurring_v1.sql. Enquanto não estiver
// aplicada, as leituras devolvem [] e as escritas devolvem erro (mostrado por
// toast) — o registo avulso de transações continua a funcionar na mesma.
export async function getRecurringRules(userId: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_month', { ascending: true })

  if (error) {
    reportError('getRecurringRules error', error.message)
    return []
  }
  return data ?? []
}

export async function saveRecurringRule(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert(payload)
    .select()
    .single()
  if (error) reportError('saveRecurringRule error', error.message)
  return { data, error }
}

export async function updateRecurringRule(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) reportError('updateRecurringRule error', error.message)
  return { data, error }
}

export async function deleteRecurringRule(id: string) {
  const { error } = await supabase.from('recurring_rules').delete().eq('id', id)
  if (error) reportError('deleteRecurringRule error', error.message)
  return { error }
}

export async function updateFinancialGoals(
  userId: string,
  goals: { fin_monthly_save?: number; fin_reserve_goal?: number; fin_current_savings?: number }
) {
  return supabase.from('profiles').update(goals).eq('id', userId)
}

// Orçamentos por categoria — persistidos em profiles.fin_budgets (JSONB).
// Substitui o armazenamento só-local; o localStorage passa a ser cache offline.
export async function updateBudgets(userId: string, budgets: Record<string, number>) {
  return supabase.from('profiles').update({ fin_budgets: budgets } as Record<string, unknown>).eq('id', userId)
}



// ── Corpo ───────────────────────────────────────────────────
export async function getTrainingPlans(userId: string, client: SupabaseClient = supabase) {
  const { data, error } = await client
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

export async function getDietPlans(userId: string, client: SupabaseClient = supabase) {
  const { data, error } = await client
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

// ── Quick actions ───────────────────────────────────────────
export async function createHabitQuick(payload: {
  user_id: string
  name: string
  area: HabitArea
  time_window?: string | null
  days?: number[] | null
}) {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      area: payload.area,
      time_window: payload.time_window?.trim() || null,
      days: payload.days && payload.days.length > 0 ? payload.days : null,
      active: true,
    })
    .select()
    .single()

  if (error) reportError('createHabitQuick error', error.message)
  return { data, error }
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
  const cutoffStr = format(cutoff, 'yyyy-MM-dd')

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
  const mondayStr   = format(monday, 'yyyy-MM-dd')

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
  const sinceStr = format(since, 'yyyy-MM-dd')

  const { count, error } = await supabase
    .from('training_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', sinceStr)

  if (error) reportError('getTrainingCount30d error', error.message)
  return count ?? 0
}

export async function getReadingPages30d(userId: string): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = format(since, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('pages_read')
    .eq('user_id', userId)
    .gte('date', sinceStr)

  if (error) reportError('getReadingPages30d error', error.message)
  return (data ?? []).reduce((sum, r) => sum + (r.pages_read ?? 0), 0)
}
