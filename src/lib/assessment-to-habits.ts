import type { Answers, AreaScores, HabitArea } from '@/types'
import { calculateScores, saveScores } from '@/lib/profile-assessment'
import {
  HABIT_CATALOG,
  BARRIER_HABITS,
  XP_BY_DIFFICULTY,
  applyRoutineWindow,
  type CatalogHabit,
  type CatalogDifficulty,
} from '@/lib/habit-catalog'

const AREAS: HabitArea[] = ['corpo', 'produtividade', 'idiomas', 'carreira', 'financas', 'emocoes', 'relacionamentos']

export type HabitLevel = 1 | 2 | 3 | 4

export interface LevelSpec {
  level: HabitLevel
  label: string
  total: number
  mix: { d1: number; d2: number; d3: number }
}

/** 4 níveis de intensidade. Piso de 3 hábitos fáceis em todos para começar pequeno. */
export const HABIT_LEVELS: LevelSpec[] = [
  { level: 1, label: 'Básico', total: 3, mix: { d1: 3, d2: 0, d3: 0 } },
  { level: 2, label: 'Em ritmo', total: 4, mix: { d1: 3, d2: 1, d3: 0 } },
  { level: 3, label: 'Consistente', total: 6, mix: { d1: 3, d2: 2, d3: 1 } },
  { level: 4, label: 'Alta performance', total: 8, mix: { d1: 3, d2: 3, d3: 2 } },
]

export function getLevelSpec(level: HabitLevel): LevelSpec {
  return HABIT_LEVELS.find((l) => l.level === level) ?? HABIT_LEVELS[0]
}

/** Área prioritária: b2_objetivo → b8_prioridades[0] → 'corpo'. */
function priorityArea(answers: Answers): HabitArea {
  const obj = answers['b2_objetivo']
  if (typeof obj === 'string' && (AREAS as string[]).includes(obj)) return obj as HabitArea
  const ranking = answers['b8_prioridades']
  if (Array.isArray(ranking) && typeof ranking[0] === 'string' && (AREAS as string[]).includes(ranking[0])) {
    return ranking[0] as HabitArea
  }
  return 'corpo'
}

/** Ordem de preferência de áreas: prioritária → ranking → mais fracas (menor score). */
function areaPreference(answers: Answers, scores: AreaScores): HabitArea[] {
  const prio = priorityArea(answers)
  const ranking = Array.isArray(answers['b8_prioridades'])
    ? (answers['b8_prioridades'] as string[]).filter((a) => (AREAS as string[]).includes(a)) as HabitArea[]
    : []
  const weakest = [...AREAS].sort((a, b) => scores[a] - scores[b])
  const ordered: HabitArea[] = []
  for (const a of [prio, ...ranking, ...weakest]) {
    if (!ordered.includes(a)) ordered.push(a)
  }
  return ordered
}

/**
 * Sugere o nível (1–4) a partir das respostas. Viés conservador: só sobe com
 * sinais positivos claros; 3+ barreiras puxam fortemente para o nível 1.
 */
export function suggestHabitLevel(answers: Answers, scores: AreaScores): HabitLevel {
  let pts = 0

  const belief = Number(answers['b5_autoimagem'] ?? 3)
  if (belief >= 4) pts += 1
  if (belief >= 5) pts += 1

  const barriers = Array.isArray(answers['b4_travas']) ? (answers['b4_travas'] as string[]).length : 0
  if (barriers >= 3) pts -= 2
  else if (barriers === 0) pts += 1

  if (answers['b3_exercicio'] === '5x_mais' || answers['b3_exercicio'] === '3_4x') pts += 1
  if (answers['b3_planejamento'] === 'sempre' || answers['b3_planejamento'] === 'quase') pts += 1

  if (scores.global >= 70) pts += 1
  else if (scores.global <= 35) pts -= 1

  if (pts <= 0) return 1
  if (pts === 1) return 2
  if (pts <= 3) return 3
  return 4
}

/**
 * Seleciona o conjunto de hábitos para um nível (puro, sem BD).
 * Slots fáceis começam pelas barreiras (anti-procrastinação), depois área
 * prioritária e áreas mais fracas. Dedup por catalog_key. Aplica b7_rotina.
 */
export function selectHabitsForLevel(answers: Answers, scores: AreaScores, level: HabitLevel): CatalogHabit[] {
  const spec = getLevelSpec(level)
  const routine = typeof answers['b7_rotina'] === 'string' ? (answers['b7_rotina'] as string) : undefined
  const prefs = areaPreference(answers, scores)
  const barriers = Array.isArray(answers['b4_travas']) ? (answers['b4_travas'] as string[]) : []

  const chosen: CatalogHabit[] = []
  const usedKeys = new Set<string>()
  const counts: Record<CatalogDifficulty, number> = { 1: 0, 2: 0, 3: 0 }
  const target: Record<CatalogDifficulty, number> = { 1: spec.mix.d1, 2: spec.mix.d2, 3: spec.mix.d3 }

  const tryAdd = (h: CatalogHabit | undefined): boolean => {
    if (!h || usedKeys.has(h.key)) return false
    usedKeys.add(h.key)
    chosen.push(h)
    counts[h.difficulty]++
    return true
  }

  // 1) hábitos anti-procrastinação para as barreiras marcadas (ocupam slots fáceis)
  for (const b of barriers) {
    if (counts[1] >= target[1]) break
    tryAdd(BARRIER_HABITS[b])
  }

  // 2) preencher por dificuldade (fácil → média → difícil), por ordem de área
  const fillDifficulty = (d: CatalogDifficulty) => {
    for (const area of prefs) {
      if (counts[d] >= target[d]) break
      for (const c of HABIT_CATALOG[area]) {
        if (counts[d] >= target[d]) break
        if (c.difficulty === d) tryAdd(c)
      }
    }
  }
  fillDifficulty(1)
  fillDifficulty(2)
  fillDifficulty(3)

  // 3) backfill se o catálogo tiver lacunas, para atingir o total
  for (const area of prefs) {
    if (chosen.length >= spec.total) break
    for (const c of HABIT_CATALOG[area]) {
      if (chosen.length >= spec.total) break
      tryAdd(c)
    }
  }

  return chosen.slice(0, spec.total).map((h) => ({ ...h, time_window: applyRoutineWindow(h, routine) }))
}

function habitRow(userId: string, h: CatalogHabit) {
  return {
    user_id: userId,
    name: h.name,
    area: h.area,
    difficulty: h.difficulty,
    xp_reward: XP_BY_DIFFICULTY[h.difficulty],
    time_window: h.time_window,
    active: true,
    source: 'onboarding' as const,
    catalog_key: h.key,
  }
}

/**
 * Gera os hábitos de onboarding para o nível escolhido, persiste scores e marca
 * o perfil como onboarded com o habit_level. NÃO define program_id (é assim que
 * o Hoje distingue utilizadores de hábitos dos de programa legado).
 */
export async function generateHabitsFromAssessment(
  userId: string,
  assessmentId: string,
  answers: Answers,
  level: HabitLevel,
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const scores = calculateScores(answers)
  await saveScores(userId, assessmentId, scores)

  const chosen = selectHabitsForLevel(answers, scores, level)
  if (chosen.length > 0) {
    const { error } = await supabase.from('habits').insert(chosen.map((h) => habitRow(userId, h)))
    if (error) throw error
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarded: true, habit_level: level, onboarding_version: 2 })
    .eq('id', userId)
  if (profileError) throw profileError
}

/**
 * Ajusta o conjunto de hábitos de onboarding para um novo nível, preservando
 * logs e hábitos manuais. Reativa hábitos soft-deleted em vez de inserir
 * duplicados; desativa (active=false) os que saem; nunca toca em source='manual'.
 */
export async function regenerateHabitsForLevel(userId: string, newLevel: HabitLevel): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  const { data: assess } = await supabase
    .from('user_assessments')
    .select('responses')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const answers = ((assess?.responses ?? {}) as Answers)
  const scores = calculateScores(answers)
  const desired = selectHabitsForLevel(answers, scores, newLevel)
  const desiredKeys = new Set(desired.map((d) => d.key))

  const { data: existing } = await supabase
    .from('habits')
    .select('id, catalog_key, active')
    .eq('user_id', userId)
    .eq('source', 'onboarding')

  const existingRows = (existing ?? []) as { id: string; catalog_key: string | null; active: boolean }[]
  const byKey = new Map<string, { id: string; active: boolean }>()
  for (const r of existingRows) {
    if (r.catalog_key) byKey.set(r.catalog_key, { id: r.id, active: r.active })
  }

  const toInsert: CatalogHabit[] = []
  const toReactivate: string[] = []
  for (const h of desired) {
    const ex = byKey.get(h.key)
    if (!ex) toInsert.push(h)
    else if (!ex.active) toReactivate.push(ex.id)
  }
  const toDeactivate = existingRows
    .filter((r) => r.active && (!r.catalog_key || !desiredKeys.has(r.catalog_key)))
    .map((r) => r.id)

  if (toInsert.length > 0) {
    const { error } = await supabase.from('habits').insert(toInsert.map((h) => habitRow(userId, h)))
    if (error) throw error
  }
  if (toReactivate.length > 0) {
    const { error } = await supabase.from('habits').update({ active: true }).in('id', toReactivate)
    if (error) throw error
  }
  if (toDeactivate.length > 0) {
    const { error } = await supabase.from('habits').update({ active: false }).in('id', toDeactivate)
    if (error) throw error
  }

  const { error: profileError } = await supabase.from('profiles').update({ habit_level: newLevel }).eq('id', userId)
  if (profileError) throw profileError
}
