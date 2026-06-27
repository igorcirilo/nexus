import { supabase } from '@/lib/supabase'
import { todayISO, parseLocalDate } from '@/lib/date'
import type { QuitHabit, HabitArea } from '@/types'

/**
 * Camada de dados dos "maus hábitos a largar" (tabelas quit_habits / quit_relapses).
 * Regra: dias limpo = hoje − quit_date. Ao recair, guardamos a melhor sequência,
 * registamos a recaída e reiniciamos quit_date para hoje.
 */

/** Número de dias inteiros entre quit_date e hoje (>= 0). */
export function daysClean(quitDate: string, today: string = todayISO()): number {
  const start = parseLocalDate(quitDate).getTime()
  const now = parseLocalDate(today).getTime()
  return Math.max(0, Math.round((now - start) / 86400000))
}

export async function getQuitHabits(userId: string): Promise<QuitHabit[]> {
  const { data } = await supabase
    .from('quit_habits')
    .select('*')
    .eq('user_id', userId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: true })
  return (data ?? []) as QuitHabit[]
}

export async function createQuitHabit(payload: {
  user_id: string
  name: string
  area?: HabitArea | null
  motivation?: string | null
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('quit_habits').insert({
    user_id: payload.user_id,
    name: payload.name.trim(),
    area: payload.area ?? null,
    motivation: payload.motivation?.trim() || null,
    quit_date: todayISO(),
    best_streak: 0,
    active: true,
  })
  return { error: error?.message ?? null }
}

export async function updateQuitHabit(
  id: string,
  updates: Partial<Pick<QuitHabit, 'name' | 'area' | 'motivation' | 'active'>>,
): Promise<void> {
  await supabase.from('quit_habits').update(updates).eq('id', id)
}

/**
 * Regista uma recaída: fecha a sequência atual (atualiza best_streak se for
 * recorde), grava a recaída no histórico e reinicia a contagem para hoje.
 */
export async function registerRelapse(habit: QuitHabit, note?: string): Promise<void> {
  const today = todayISO()
  const currentStreak = daysClean(habit.quit_date, today)
  const best = Math.max(habit.best_streak, currentStreak)

  await supabase.from('quit_relapses').insert({
    user_id: habit.user_id,
    quit_habit_id: habit.id,
    date: today,
    note: note?.trim() || null,
  })
  await supabase
    .from('quit_habits')
    .update({ quit_date: today, best_streak: best })
    .eq('id', habit.id)
}

export async function deleteQuitHabit(id: string): Promise<void> {
  await supabase.from('quit_habits').delete().eq('id', id)
}

export async function countRelapses(habitId: string): Promise<number> {
  const { count } = await supabase
    .from('quit_relapses')
    .select('*', { count: 'exact', head: true })
    .eq('quit_habit_id', habitId)
  return count ?? 0
}
