// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { HabitArea, WeeklyLeagueOverview, WeeklyLeagueStanding } from '@/types'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

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

// ── XP & Streak ────────────────────────────────────────────
export async function addXP(userId: string, xp: number) {
  return supabase.rpc('add_xp', { p_user_id: userId, p_xp: xp })
}

export async function updateStreak(userId: string) {
  return supabase.rpc('update_streak', { p_user_id: userId })
}

// ── Sessões de foco ────────────────────────────────────────
export async function saveFocusSession(
  userId: string, duration: number, task?: string,
) {
  return supabase.from('focus_sessions').insert({
    user_id: userId, duration, task, xp_earned: 10,
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
      .select('date, duration, xp_earned')
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
    .select('*')
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

export async function getAgendaEvents(userId: string, year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-31`
  const { data, error } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('time')

  if (error) {
    console.error('getAgendaEvents error:', error.message)
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

    if (error) console.error('saveAgendaEvent update error:', error.message)
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

  if (error) console.error('saveAgendaEvent insert error:', error.message)
  return { data: data as AgendaEvent | null, error }
}

export async function deleteAgendaEvent(id: string, userId?: string) {
  let query = supabase.from('agenda_events').delete().eq('id', id)
  if (userId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) console.error('deleteAgendaEvent error:', error.message)
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
    console.error('getTransactions error:', error.message)
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
    console.error('getTransactionsByMonth error:', error.message)
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
  if (error) console.error('saveTransaction error:', error.message)
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

  if (error) console.error('saveTransactionsBulk error:', error.message)
  return { data: data ?? [], error }
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) console.error('deleteTransaction error:', error.message)
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
    console.error('getTrainingPlans error:', error.message)
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

  if (error) console.error('saveTrainingPlan error:', error.message)
  return { data, error }
}

export async function getDietPlans(userId: string) {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getDietPlans error:', error.message)
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

  if (error) console.error('saveDietPlan error:', error.message)
  return { data, error }
}

// ── Badges automáticos ─────────────────────────────────────
const BADGE_NAMES: Record<string, string> = {
  primeiro_checkin: 'Primeira Vez',
  streak_7: 'Uma Semana',
  streak_21: 'Três Semanas',
  streak_100: 'Centenário',
  xp_1000: 'Mil Pontos',
  xp_5000: 'Veterano',
  xp_10000: 'Elite',
}

export async function checkAndAwardBadges(
  userId: string,
  profile: { streak_current: number; xp_total: number },
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
  if (profile.xp_total >= 1000 && !earned.has('xp_1000')) toAward.push('xp_1000')
  if (profile.xp_total >= 5000 && !earned.has('xp_5000')) toAward.push('xp_5000')
  if (profile.xp_total >= 10000 && !earned.has('xp_10000')) toAward.push('xp_10000')

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

  await supabase.rpc('add_xp', { p_user_id: userId, p_xp: 10 })

  return true
}

// ── Liga semanal de XP ─────────────────────────────────────
// Calcula XP ganho desde a última segunda-feira
export async function getWeeklyLeagueXP(userId: string): Promise<number> {
  // Segunda-feira desta semana
  const now = new Date()
  const day = now.getDay() // 0=dom, 1=seg...
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().split('T')[0]

  // XP de check-ins
  const { data: checkins } = await supabase
    .from('checkins')
    .select('xp_earned')
    .eq('user_id', userId)
    .gte('date', mondayStr)

  const checkinXP = (checkins ?? []).reduce(
    (sum, c: { xp_earned: number | null }) => sum + (c.xp_earned ?? 0), 0
  )

  // XP de hábitos completados (cada hábito completo = xp_reward ou 10 por defeito)
  const { data: logs } = await supabase
    .from('habit_logs')
    .select('habit_id, completed')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', mondayStr)

  // Buscar XP de cada hábito
  const habitIds = Array.from(new Set((logs ?? []).map((l: { habit_id: string }) => l.habit_id)))
  let habitXP = 0

  if (habitIds.length > 0) {
    const { data: habits } = await supabase
      .from('habits')
      .select('id, xp_reward')
      .in('id', habitIds)

    const xpMap: Record<string, number> = {}
    for (const h of (habits ?? []) as { id: string; xp_reward: number | null }[]) {
      xpMap[h.id] = h.xp_reward ?? 10
    }

    habitXP = (logs ?? []).reduce(
      (sum, l: { habit_id: string; completed: boolean }) =>
        sum + (l.completed ? (xpMap[l.habit_id] ?? 10) : 0),
      0
    )
  }

  // XP de sessões de foco
  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('xp_earned')
    .eq('user_id', userId)
    .gte('date', mondayStr)

  const sessionXP = (sessions ?? []).reduce(
    (sum, s: { xp_earned: number | null }) => sum + (s.xp_earned ?? 0), 0
  )

  return checkinXP + habitXP + sessionXP
}


// ── Quick actions ───────────────────────────────────────────
export async function createHabitQuick(payload: {
  user_id: string
  name: string
  area: HabitArea
  xp_reward: number
  time_window?: string | null
}) {
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      area: payload.area,
      xp_reward: payload.xp_reward,
      time_window: payload.time_window?.trim() || null,
      active: true,
    })
    .select()
    .single()

  if (error) console.error('createHabitQuick error:', error.message)
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

function getLeagueTier(xp: number): WeeklyLeagueStanding['tier'] {
  if (xp >= 750) return 'Lenda'
  if (xp >= 400) return 'Ouro'
  if (xp >= 150) return 'Prata'
  return 'Bronze'
}

export async function ensureWeeklyLeagueSnapshot(userId: string) {
  const { weekStart, weekEnd } = getWeekWindow()
  const xp = await getWeeklyLeagueXP(userId)
  const tier = getLeagueTier(xp)

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
      xp,
      tier,
      username: profile?.username ?? 'Guerreiro',
      level: profile?.level ?? 1,
      title: profile?.title ?? 'Recruta',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    .select()
    .single()

  if (error) {
    console.error('ensureWeeklyLeagueSnapshot error:', error.message)
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
    .select('user_id, week_start, week_end, xp, tier, username, level, title, updated_at')
    .eq('week_start', weekStart)
    .order('xp', { ascending: false })
    .order('updated_at', { ascending: true })

  if (error) {
    console.error('getWeeklyLeagueOverview current error:', error.message)
    return null
  }

  const standings = (rows ?? []).map((row, index) => ({
    user_id: row.user_id as string,
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    xp: row.xp as number,
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
    .select('user_id, week_start, week_end, xp, tier, username, level, title, updated_at')
    .eq('week_start', prevWeekStart)
    .order('xp', { ascending: false })
    .order('updated_at', { ascending: true })

  const previousStandings = (previousRows ?? []).map((row, index) => ({
    user_id: row.user_id as string,
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    xp: row.xp as number,
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
    .select('week_start, week_end, xp, tier')
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
    previous_xp: previousMe?.xp ?? null,
    history: (historyRows ?? []).map(row => ({
      week_start: row.week_start as string,
      week_end: row.week_end as string,
      xp: row.xp as number,
      tier: row.tier as WeeklyLeagueStanding['tier'],
      rank: row.week_start === weekStart ? me?.rank ?? null : previousRows
        ? previousStandings.find(item => item.user_id === userId && item.week_start === row.week_start)?.rank ?? null
        : null,
    })),
  }
}
