import { format } from 'date-fns'
import type { ProgramDay, ProgramTask, HabitArea } from '@/types'

export async function getProgramDayByDate(
  userId: string,
  date: Date = new Date()
): Promise<ProgramDay | null> {
  const { supabase } = await import('@/lib/supabase')
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('program_days')
    .select('*, programs!inner(user_id)')
    .eq('programs.user_id', userId)
    .eq('date', dateStr)
    .maybeSingle()

  if (error) {
    console.error('getProgramDayByDate error:', error.message)
    return null
  }

  return data as ProgramDay | null
}

export async function getProgramTasks(dayId: string): Promise<ProgramTask[]> {
  const { supabase } = await import('@/lib/supabase')

  const { data, error } = await supabase
    .from('program_tasks')
    .select('*')
    .eq('day_id', dayId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getProgramTasks error:', error.message)
    return []
  }

  return (data ?? []) as ProgramTask[]
}

export async function updateTaskStatus(
  taskId: string,
  status: 'completed' | 'skipped'
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')
  const updates: Record<string, unknown> = { status }

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('program_tasks')
    .update(updates)
    .eq('id', taskId)

  if (error) throw error
}

export async function createManualTask(
  userId: string,
  dayId: string,
  programId: string,
  title: string,
  area: HabitArea
): Promise<ProgramTask> {
  const { supabase } = await import('@/lib/supabase')

  const { data, error } = await supabase
    .from('program_tasks')
    .insert({
      user_id: userId,
      day_id: dayId,
      program_id: programId,
      template_id: null,
      title,
      description: null,
      area,
      difficulty: 1,
      xp_reward: 15,
      status: 'pending',
      source: 'manual',
    })
    .select()
    .single()

  if (error) throw error
  return data as ProgramTask
}
