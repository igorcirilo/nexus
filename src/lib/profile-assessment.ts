import { ONBOARDING_QUESTIONS } from '@/lib/onboarding-engine'
import type { Answers, AreaScores, Question, HabitArea } from '@/types'

const AREAS: HabitArea[] = [
  'corpo', 'produtividade', 'idiomas', 'carreira',
  'financas', 'emocoes', 'relacionamentos',
]

function normalizeAnswer(question: Question, answer: Answers[string]): number | null {
  switch (question.type) {
    case 'scale': {
      const val = typeof answer === 'number' ? answer : Number(answer)
      if (isNaN(val)) return null
      const min = question.min ?? 1
      const max = question.max ?? 5
      const normalized = (val - min) / (max - min)
      return question.invert ? 1 - normalized : normalized
    }
    case 'single': {
      const option = question.options?.find(o => o.id === answer)
      return option ? option.score_value : null
    }
    case 'multiple': {
      const selected = Array.isArray(answer) ? answer : []
      if (question.invert) {
        const total = question.options?.length ?? 1
        return Math.max(0, (total - selected.length) / total)
      }
      if (selected.length === 0) return 0.5
      const total = selected.reduce((sum, id) => {
        const opt = question.options?.find(o => o.id === id)
        return sum + (opt ? opt.score_value : 0)
      }, 0)
      return total / selected.length
    }
    case 'ranking':
      return null
    default:
      return null
  }
}

export function calculateScores(answers: Answers): AreaScores {
  const accumulators: Record<HabitArea, { weightedSum: number; totalWeight: number }> = {
    corpo: { weightedSum: 0, totalWeight: 0 },
    produtividade: { weightedSum: 0, totalWeight: 0 },
    idiomas: { weightedSum: 0, totalWeight: 0 },
    carreira: { weightedSum: 0, totalWeight: 0 },
    financas: { weightedSum: 0, totalWeight: 0 },
    emocoes: { weightedSum: 0, totalWeight: 0 },
    relacionamentos: { weightedSum: 0, totalWeight: 0 },
  }

  for (const question of ONBOARDING_QUESTIONS) {
    if (!question.area || question.weight === 0) continue

    const answer = answers[question.id]
    if (answer === undefined || answer === null) continue

    const normalized = normalizeAnswer(question, answer)
    if (normalized === null) continue

    const affectedAreas = Array.isArray(question.area) ? question.area : [question.area]
    for (const area of affectedAreas) {
      accumulators[area].weightedSum += normalized * question.weight
      accumulators[area].totalWeight += question.weight
    }
  }

  const scores = {} as Record<HabitArea, number>
  for (const area of AREAS) {
    const acc = accumulators[area]
    const raw = acc.totalWeight === 0 ? 50 : (acc.weightedSum / acc.totalWeight) * 100
    scores[area] = Math.max(0, Math.min(100, Math.round(raw)))
  }

  const global = Math.round(AREAS.reduce((sum, area) => sum + scores[area], 0) / AREAS.length)

  return { ...scores, global }
}

export async function saveScores(
  userId: string,
  assessmentId: string,
  scores: AreaScores
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const rows = AREAS.map(area => ({
    user_id: userId,
    assessment_id: assessmentId,
    area,
    score: scores[area],
    snapshot_at: new Date().toISOString(),
  }))

  const { error: scoresError } = await supabase
    .from('life_area_scores')
    .insert(rows)

  if (scoresError) throw scoresError

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      initial_score: scores.global,
      current_score: scores.global,
    })
    .eq('id', userId)

  if (profileError) throw profileError
}
