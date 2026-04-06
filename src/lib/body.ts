'use client'

import { supabase } from '@/lib/supabase'

export async function getTrainingEntries(userId: string, date: string) {
  const { data, error } = await supabase
    .from('training_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getTrainingEntries error:', error.message)
    return []
  }

  return data ?? []
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

  if (error) {
    console.error('upsertTrainingEntry error:', error.message)
  }

  return { data, error }
}

export async function getDietMeals(userId: string, date: string) {
  const { data, error } = await supabase
    .from('diet_meals')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getDietMeals error:', error.message)
    return []
  }

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

  if (error) {
    console.error('upsertDietMeal error:', error.message)
  }

  return { data, error }
}
