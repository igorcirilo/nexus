import { format } from 'date-fns'
import type { Program, ProgramWeek, ProgramDay, ProgramTask, HabitArea } from '@/types'
import { FALLBACK_TASK_TEMPLATES, shouldTaskBeOnDay } from '@/lib/program-engine'

export type DayWithCounts = ProgramDay & {
  task_counts: { total: number; completed: number }
}

export type WeekWithDays = ProgramWeek & {
  days: DayWithCounts[]
}

export async function getProgramDayByDate(
  programId: string,
  date: Date = new Date()
): Promise<ProgramDay | null> {
  const { supabase } = await import('@/lib/supabase')
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .eq('date', dateStr)
    .maybeSingle()

  if (error) {
    console.error('getProgramDayByDate error:', error.message)
  }

  if (data) {
    return data as ProgramDay
  }

  const { data: nextDay, error: nextDayError } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .gte('date', dateStr)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextDayError) {
    console.error('getProgramDayByDate nextDay error:', nextDayError.message)
  }

  if (nextDay) {
    return nextDay as ProgramDay
  }

  const { data: lastDay, error: lastDayError } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .lte('date', dateStr)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastDayError) {
    console.error('getProgramDayByDate lastDay error:', lastDayError.message)
    return null
  }

  return (lastDay ?? null) as ProgramDay | null
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

export async function getFirstProgramDayWithTasks(
  programId: string
): Promise<ProgramDay | null> {
  const { supabase } = await import('@/lib/supabase')

  const { data: firstTask, error: firstTaskError } = await supabase
    .from('program_tasks')
    .select('day_id')
    .eq('program_id', programId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstTaskError) {
    console.error('getFirstProgramDayWithTasks firstTask error:', firstTaskError.message)
    return null
  }

  if (!firstTask?.day_id) {
    return null
  }

  const { data: day, error: dayError } = await supabase
    .from('program_days')
    .select('*')
    .eq('id', firstTask.day_id)
    .maybeSingle()

  if (dayError) {
    console.error('getFirstProgramDayWithTasks day error:', dayError.message)
    return null
  }

  return (day ?? null) as ProgramDay | null
}

export async function ensureProgramHasTasks(
  userId: string,
  programId: string
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const { data: existingTask, error: existingTaskError } = await supabase
    .from('program_tasks')
    .select('id')
    .eq('program_id', programId)
    .limit(1)
    .maybeSingle()

  if (existingTaskError) {
    console.error('ensureProgramHasTasks existingTask error:', existingTaskError.message)
    return
  }

  if (existingTask) {
    return
  }

  const { data: days, error: daysError } = await supabase
    .from('program_days')
    .select('id, day_number')
    .eq('program_id', programId)
    .order('day_number', { ascending: true })

  if (daysError) {
    console.error('ensureProgramHasTasks days error:', daysError.message)
    return
  }

  if (!days || days.length === 0) {
    return
  }

  const { data: templates, error: templatesError } = await supabase
    .from('task_templates')
    .select('*')
    .eq('active', true)

  if (templatesError) {
    console.error('ensureProgramHasTasks templates error:', templatesError.message)
  }

  const availableTemplates = ((templates ?? []) as Array<Record<string, unknown>>).length > 0
    ? (templates as Array<Record<string, unknown>>)
    : FALLBACK_TASK_TEMPLATES

  const selectedTemplates = availableTemplates
    .filter((template) => Number(template.difficulty ?? 1) === 1)
    .sort((a, b) => Number(b.frequency_per_week ?? 0) - Number(a.frequency_per_week ?? 0))
    .slice(0, 3)

  if (selectedTemplates.length === 0) {
    return
  }

  const taskRows: Record<string, unknown>[] = []

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex]

    for (const template of selectedTemplates) {
      const frequencyPerWeek = Number(template.frequency_per_week ?? 7)
      if (!shouldTaskBeOnDay(frequencyPerWeek, dayIndex)) continue

      taskRows.push({
        program_id: programId,
        day_id: day.id,
        user_id: userId,
        template_id: String(template.id).startsWith('fallback-') ? null : template.id,
        title: template.title,
        description: template.description ?? null,
        area: template.area,
        difficulty: template.difficulty ?? 1,
        xp_reward: template.xp_reward ?? 15,
        status: 'pending',
        source: 'generated',
      })
    }
  }

  if (taskRows.length === 0) {
    return
  }

  const { error: insertError } = await supabase
    .from('program_tasks')
    .insert(taskRows)

  if (insertError) {
    console.error('ensureProgramHasTasks insert error:', insertError.message)
  }
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

export async function getProgramWithWeeks(userId: string): Promise<{
  program: Program
  weeks: WeekWithDays[]
} | null> {
  const { supabase } = await import('@/lib/supabase')

  const { data: prog, error: progError } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (progError) { console.error('getProgramWithWeeks:', progError.message); return null }
  if (!prog) return null

  const { data: rawWeeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('*, program_days(*, program_tasks(id, status))')
    .eq('program_id', prog.id)
    .order('week_number')

  if (weeksError) { console.error('getProgramWithWeeks weeks:', weeksError.message); return null }

  const weeks: WeekWithDays[] = (rawWeeks ?? []).map((w: Record<string, unknown>) => {
    const rawDays = (w.program_days as Record<string, unknown>[]) ?? []
    const days: DayWithCounts[] = rawDays
      .sort((a, b) => Number(a.day_number) - Number(b.day_number))
      .map(d => {
        const tasks = (d.program_tasks as Array<{ id: string; status: string }>) ?? []
        return {
          id: d.id as string,
          program_id: d.program_id as string,
          week_id: d.week_id as string,
          day_number: d.day_number as number,
          date: d.date as string,
          created_at: d.created_at as string,
          task_counts: {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length,
          },
        }
      })
    return {
      id: w.id as string,
      program_id: w.program_id as string,
      week_number: w.week_number as number,
      theme: w.theme as string,
      starts_on: w.starts_on as string,
      created_at: w.created_at as string,
      days,
    }
  })

  return { program: prog as Program, weeks }
}

export async function getTasksForDate(
  userId: string,
  date: string
): Promise<ProgramTask[]> {
  const { supabase } = await import('@/lib/supabase')

  const { data: prog } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!prog) return []

  const { data: day } = await supabase
    .from('program_days')
    .select('id')
    .eq('program_id', prog.id)
    .eq('date', date)
    .maybeSingle()

  if (!day) return []

  return getProgramTasks(day.id)
}
