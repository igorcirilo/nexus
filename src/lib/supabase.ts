// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

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
  const start = `${year}-${String(month).padStart(2,'0')}-01`
  const end   = `${year}-${String(month).padStart(2,'0')}-31`
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
// Calcula a área com menos consistência nos últimos 14 dias
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

  // Agrupar por área
  const areaMap: Record<string, { ids: string[]; done: number; total: number }> = {}
  for (const h of habits as { id: string; area: string }[]) {
    if (!areaMap[h.area]) areaMap[h.area] = { ids: [], done: 0, total: 0 }
    areaMap[h.area].ids.push(h.id)
  }

  for (const log of logs as { habit_id: string; completed: boolean }[]) {
    for (const [area, data] of Object.entries(areaMap)) {
      if (data.ids.includes(log.habit_id)) {
        data.total++
        if (log.completed) data.done++
      }
    }
  }

  // Área com pior consistência
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

  // Dias completos esta semana na área
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

// ── Finanças ───────────────────────────────────────────────
export async function getTransactions(userId: string, months = 1) {
  const since = new Date()
  since.setMonth(since.getMonth() - months + 1)
  since.setDate(1)
  const sinceStr = since.toISOString().split('T')[0]

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceStr)
    .order('date', { ascending: false })
  return data ?? []
}

export async function saveTransaction(payload: Record<string, unknown>) {
  return supabase.from('transactions').insert(payload)
}

export async function deleteTransaction(id: string) {
  return supabase.from('transactions').delete().eq('id', id)
}

// ── Auth helpers ────────────────────────────────────────────
export async function signOut() {
  return supabase.auth.signOut()
}

// Verificar sessão activa
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
