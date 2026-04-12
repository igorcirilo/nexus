import { calculateScores, saveScores } from '@/lib/profile-assessment'
import { createProgram, generate63Days, FALLBACK_TASK_TEMPLATES } from '@/lib/program-engine'
import type { Answers, HabitArea, TaskTemplate } from '@/types'

export async function generateProgramFromAssessment(
  userId: string,
  assessmentId: string,
  answers: Answers
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const scores = calculateScores(answers)

  await saveScores(userId, assessmentId, scores)

  const priorityArea = (answers['b2_objetivo'] as HabitArea | undefined)
    ?? (Array.isArray(answers['b8_prioridades'])
      ? (answers['b8_prioridades'] as string[])[0] as HabitArea
      : 'corpo')

  const program = await createProgram(userId, assessmentId)

  const { data: templates, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('active', true)

  if (error) throw error

  const availableTemplates = ((templates ?? []) as TaskTemplate[]).length > 0
    ? (templates as TaskTemplate[])
    : FALLBACK_TASK_TEMPLATES

  await generate63Days(userId, program.id, availableTemplates, scores, priorityArea)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      onboarded: true,
      program_id: program.id,
      onboarding_version: 2,
    })
    .eq('id', userId)

  if (profileError) throw profileError
}
