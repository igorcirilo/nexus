// src/lib/body.ts
import { supabase } from '@/lib/supabase'
import { emitToast } from '@/lib/toast-events'
import { format, subDays } from 'date-fns'

function reportErr(ctx: string, msg: string) {
  console.error(`[${ctx}]`, msg || 'erro desconhecido')
  emitToast(`Erro: ${ctx}`, 'error')
}

// ── Training Entries ────────────────────────────────────────

export async function getTrainingEntries(userId: string, date: string) {
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false })
  if (error) { reportErr('getTrainingEntries', error.message); return [] }
  return data ?? []
}

export async function getPrevTrainingEntry(userId: string, planId: string, date: string) {
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('training_plan_id', planId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { reportErr('getPrevTrainingEntry', error.message); return null }
  return data ?? null
}

export async function upsertTrainingEntry(payload: {
  user_id: string
  training_plan_id: string
  date: string
  completed: boolean
  notes?: string | null
}) {
  const record = {
    ...payload,
    notes: payload.notes ?? null,
    completed_at: payload.completed ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase
    .from('training_entries')
    .upsert(record, { onConflict: 'user_id,training_plan_id,date' })
    .select()
    .single()
  if (error) reportErr('upsertTrainingEntry', error.message)
  return { data, error }
}

// ── Diet Meals ──────────────────────────────────────────────

export async function getDietMeals(userId: string, date: string) {
  const { data, error } = await supabase
    .from('diet_meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) { reportErr('getDietMeals', error.message); return [] }
  return data ?? []
}

export async function upsertDietMeal(payload: {
  user_id: string
  diet_plan_id: string
  date: string
  meal_key: 'pequeno_almoco' | 'almoco' | 'jantar' | 'lanche'
  completed: boolean
  notes?: string | null
}) {
  const record = {
    ...payload,
    notes: payload.notes ?? null,
    completed_at: payload.completed ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase
    .from('diet_meals')
    .upsert(record, { onConflict: 'user_id,diet_plan_id,date,meal_key' })
    .select()
    .single()
  if (error) reportErr('upsertDietMeal', error.message)
  return { data, error }
}

// ── Plan Deletion ───────────────────────────────────────────

export async function deleteTrainingPlan(id: string, userId: string) {
  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteTrainingPlan', error.message)
  return { error }
}

export async function deleteDietPlan(id: string, userId: string) {
  const { error } = await supabase
    .from('diet_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteDietPlan', error.message)
  return { error }
}

// ── Weight Logs ─────────────────────────────────────────────

export type WeightLog = {
  id: string
  user_id: string
  date: string
  weight_kg: number
  created_at: string
}

export async function getWeightLogs(userId: string, days?: number): Promise<WeightLog[]> {
  let query = supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (days) {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
    query = query.gte('date', since)
  }

  const { data, error } = await query
  if (error) { reportErr('getWeightLogs', error.message); return [] }
  return (data ?? []) as WeightLog[]
}

export async function upsertWeightLog(userId: string, date: string, weightKg: number) {
  const { data, error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) reportErr('upsertWeightLog', error.message)
  return { data: data as WeightLog | null, error }
}

export async function deleteWeightLog(userId: string, id: string) {
  const { error } = await supabase
    .from('body_measurements')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) reportErr('deleteWeightLog', error.message)
  return { error }
}
