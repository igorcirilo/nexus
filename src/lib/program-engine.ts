import { format, addDays } from 'date-fns'
import type { TaskTemplate, AreaScores, HabitArea, Program } from '@/types'

const AREAS: HabitArea[] = [
  'corpo', 'produtividade', 'idiomas', 'carreira',
  'financas', 'emocoes', 'relacionamentos',
]

export function difficultyForWeek(weekNumber: number): 1 | 2 | 3 {
  if (weekNumber <= 3) return 1
  if (weekNumber <= 6) return 2
  return 3
}

export function selectTemplatesForProgram(
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  weekNumber: number
): TaskTemplate[] {
  const targetDifficulty = difficultyForWeek(weekNumber)
  let candidates = templates.filter(t => t.difficulty === targetDifficulty && t.active)

  // Fallback: se n?o houver templates no n?vel alvo, usa difficulty 1
  if (candidates.length === 0) {
    candidates = templates.filter(t => t.difficulty === 1 && t.active)
  }

  const lowestArea = AREAS.reduce((a, b) => (scores[a] < scores[b] ? a : b))
  const selected: TaskTemplate[] = []

  const fromLowest = candidates.find(t => t.area === lowestArea)
  if (fromLowest) selected.push(fromLowest)

  if (priorityArea !== lowestArea) {
    const fromPriority = candidates.find(
      t => t.area === priorityArea && !selected.some(s => s.id === t.id)
    )
    if (fromPriority) selected.push(fromPriority)
  }

  const remaining = candidates
    .filter(t => !selected.some(s => s.id === t.id))
    .sort((a, b) => b.frequency_per_week - a.frequency_per_week)

  for (const template of remaining) {
    if (selected.length >= 3) break
    selected.push(template)
  }

  return selected.slice(0, 3)
}

export function shouldTaskBeOnDay(frequencyPerWeek: number, dayIndex: number): boolean {
  if (frequencyPerWeek >= 7) return true
  if (frequencyPerWeek >= 5) return dayIndex <= 4
  if (frequencyPerWeek >= 3) return dayIndex === 0 || dayIndex === 2 || dayIndex === 4
  return dayIndex === 0
}

export function selectTemplatesForWeek1(
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea
): TaskTemplate[] {
  const candidates = templates.filter(t => t.difficulty === 1 && t.active)
  const lowestArea = AREAS.reduce((a, b) => (scores[a] < scores[b] ? a : b))
  const selected: TaskTemplate[] = []

  const fromLowest = candidates.find(t => t.area === lowestArea)
  if (fromLowest) selected.push(fromLowest)

  if (priorityArea !== lowestArea) {
    const fromPriority = candidates.find(
      t => t.area === priorityArea && !selected.some(s => s.id === t.id)
    )
    if (fromPriority) selected.push(fromPriority)
  }

  const remaining = candidates
    .filter(t => !selected.some(s => s.id === t.id))
    .sort((a, b) => b.frequency_per_week - a.frequency_per_week)

  for (const template of remaining) {
    if (selected.length >= 3) break
    selected.push(template)
  }

  return selected.slice(0, 3)
}

export async function createProgram(
  userId: string,
  assessmentId: string
): Promise<Program> {
  const { supabase } = await import('@/lib/supabase')
  const today = new Date()
  const startedAt = format(today, 'yyyy-MM-dd')
  const endsAt = format(addDays(today, 60), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      assessment_id: assessmentId,
      status: 'active',
      started_at: startedAt,
      ends_at: endsAt,
    })
    .select()
    .single()

  if (error) throw error
  return data as Program
}

export async function generateWeek1(
  userId: string,
  programId: string,
  templates: TaskTemplate[],
  startDate: Date = new Date()
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const { data: week, error: weekError } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_number: 1,
      theme: 'Fundação',
      starts_on: format(startDate, 'yyyy-MM-dd'),
    })
    .select('id')
    .single()

  if (weekError) throw weekError

  const dayRows = Array.from({ length: 7 }, (_, i) => ({
    program_id: programId,
    week_id: week.id,
    day_number: i + 1,
    date: format(addDays(startDate, i), 'yyyy-MM-dd'),
  }))

  const { data: days, error: daysError } = await supabase
    .from('program_days')
    .insert(dayRows)
    .select('id, day_number')

  if (daysError) throw daysError

  const taskRows: Record<string, unknown>[] = []
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex]
    for (const template of templates) {
      if (!shouldTaskBeOnDay(template.frequency_per_week, dayIndex)) continue
      taskRows.push({
        program_id: programId,
        day_id: day.id,
        user_id: userId,
        template_id: template.id,
        title: template.title,
        description: template.description,
        area: template.area,
        difficulty: template.difficulty,
        xp_reward: template.xp_reward,
        status: 'pending',
        source: 'generated',
      })
    }
  }

  const { error: tasksError } = await supabase
    .from('program_tasks')
    .insert(taskRows)

  if (tasksError) throw tasksError
}
