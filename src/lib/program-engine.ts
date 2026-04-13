import { format, addDays } from 'date-fns'
import type { TaskTemplate, AreaScores, HabitArea, Program } from '@/types'

const AREAS: HabitArea[] = [
  'corpo', 'produtividade', 'idiomas', 'carreira',
  'financas', 'emocoes', 'relacionamentos',
]

function toNullableUuid(value: string | null | undefined): string | null {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

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

  // Fallback: se não houver templates no nível alvo, usa difficulty 1
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

function candidatesForWeek(
  templates: TaskTemplate[],
  weekNumber: number
): TaskTemplate[] {
  const targetDifficulty = difficultyForWeek(weekNumber)
  const exact = templates.filter(t => t.difficulty === targetDifficulty && t.active)
  if (exact.length > 0) return exact
  return templates.filter(t => t.difficulty === 1 && t.active)
}

function buildWeekTemplatePool(
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  weekNumber: number
): TaskTemplate[] {
  const base = selectTemplatesForProgram(templates, scores, priorityArea, weekNumber)
  const candidates = candidatesForWeek(templates, weekNumber)
  const lowestArea = AREAS.reduce((a, b) => (scores[a] < scores[b] ? a : b))

  const ranked = candidates
    .filter(candidate => !base.some(selected => selected.id === candidate.id))
    .sort((a, b) => {
      const rank = (template: TaskTemplate) => {
        let score = Number(template.frequency_per_week ?? 0)
        if (template.area === priorityArea) score += 4
        if (template.area === lowestArea) score += 3
        if (template.difficulty === difficultyForWeek(weekNumber)) score += 2
        return score
      }

      const diff = rank(b) - rank(a)
      if (diff !== 0) return diff
      return a.title.localeCompare(b.title)
    })

  const pool = [...base]
  for (const template of ranked) {
    if (pool.length >= 6) break
    pool.push(template)
  }

  return pool
}

const WEEK_THEMES = [
  'Fundação',
  'Ritmo',
  'Consistência',
  'Foco',
  'Expansão',
  'Profundidade',
  'Resistência',
  'Excelência',
  'Legado',
] as const

export const FALLBACK_TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'fallback-corpo-hidratacao',
    area: 'corpo',
    title: 'Beber 2L de agua',
    description: 'Hidrate-se ao longo do dia. Beba um copo a cada 2 horas.',
    difficulty: 1,
    frequency_per_week: 7,
    xp_reward: 15,
    tags: ['hidratacao', 'saude'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-corpo-movimento',
    area: 'corpo',
    title: '20min de movimento',
    description: 'Caminhada, mobilidade ou treino leve por 20 minutos.',
    difficulty: 1,
    frequency_per_week: 5,
    xp_reward: 20,
    tags: ['movimento', 'saude'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-produtividade-planejamento',
    area: 'produtividade',
    title: 'Planejar o dia (5min)',
    description: 'Escreva suas 3 prioridades do dia antes de comecar.',
    difficulty: 1,
    frequency_per_week: 7,
    xp_reward: 15,
    tags: ['planejamento', 'foco'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-produtividade-foco',
    area: 'produtividade',
    title: 'Bloco de foco de 25min',
    description: 'Trabalhe sem interrupcoes por 25 minutos em uma unica tarefa.',
    difficulty: 1,
    frequency_per_week: 5,
    xp_reward: 20,
    tags: ['foco', 'pomodoro'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-emocoes-gratidao',
    area: 'emocoes',
    title: 'Escrever 1 gratidao',
    description: 'Anote uma coisa pela qual voce e grato hoje.',
    difficulty: 1,
    frequency_per_week: 7,
    xp_reward: 15,
    tags: ['gratidao', 'bem-estar'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-idiomas-estudo',
    area: 'idiomas',
    title: 'Praticar idioma por 10min',
    description: 'Revise vocabulario, escute audio ou pratique leitura por 10 minutos.',
    difficulty: 1,
    frequency_per_week: 5,
    xp_reward: 20,
    tags: ['idioma', 'aprendizagem'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-financas-registro',
    area: 'financas',
    title: 'Registrar 1 gasto',
    description: 'Anote um gasto do dia e classifique a categoria.',
    difficulty: 1,
    frequency_per_week: 7,
    xp_reward: 15,
    tags: ['financas', 'controle'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-relacionamentos-mensagem',
    area: 'relacionamentos',
    title: 'Mensagem para alguem importante',
    description: 'Envie uma mensagem genuina para fortalecer uma conexao.',
    difficulty: 1,
    frequency_per_week: 3,
    xp_reward: 20,
    tags: ['relacionamentos', 'conexao'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-carreira-leitura',
    area: 'carreira',
    title: 'Ler algo da sua area',
    description: 'Leia um artigo, resumo ou capitulo util para o seu crescimento.',
    difficulty: 1,
    frequency_per_week: 3,
    xp_reward: 20,
    tags: ['carreira', 'leitura'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-corpo-treino30',
    area: 'corpo',
    title: 'Treinar 30min',
    description: 'Faca 30 minutos de exercicio moderado.',
    difficulty: 2,
    frequency_per_week: 3,
    xp_reward: 25,
    tags: ['treino', 'corpo'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-produtividade-foco60',
    area: 'produtividade',
    title: 'Bloco de foco de 60min',
    description: 'Trabalhe 60 minutos sem notificacoes.',
    difficulty: 2,
    frequency_per_week: 5,
    xp_reward: 25,
    tags: ['foco', 'deep-work'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-emocoes-meditacao',
    area: 'emocoes',
    title: 'Meditacao 10min',
    description: 'Meditacao guiada ou respiracao consciente por 10 minutos.',
    difficulty: 2,
    frequency_per_week: 5,
    xp_reward: 25,
    tags: ['meditacao', 'bem-estar'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-financas-revisao',
    area: 'financas',
    title: 'Revisar gastos da semana',
    description: 'Olhe entradas e saidas recentes e ajuste o rumo da semana.',
    difficulty: 2,
    frequency_per_week: 2,
    xp_reward: 25,
    tags: ['financas', 'revisao'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-corpo-intenso',
    area: 'corpo',
    title: 'Treino intenso 45min',
    description: 'Treino mais forte com foco em intensidade e execucao.',
    difficulty: 3,
    frequency_per_week: 4,
    xp_reward: 35,
    tags: ['treino', 'intensidade'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-produtividade-deepwork2h',
    area: 'produtividade',
    title: 'Deep work de 2h',
    description: 'Dois blocos longos de foco em uma tarefa importante.',
    difficulty: 3,
    frequency_per_week: 3,
    xp_reward: 35,
    tags: ['deep-work', 'foco'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-carreira-projeto',
    area: 'carreira',
    title: 'Projeto pessoal 45min',
    description: 'Avance no seu portfolio, projeto ou estudo aplicado.',
    difficulty: 3,
    frequency_per_week: 3,
    xp_reward: 35,
    tags: ['carreira', 'projeto'],
    active: true,
    created_at: new Date(0).toISOString(),
  },
]

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
  const endsAt = format(addDays(today, 62), 'yyyy-MM-dd')

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

export async function generate63Days(
  userId: string,
  programId: string,
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  startDate: Date = new Date()
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  for (let weekIndex = 0; weekIndex < 9; weekIndex++) {
    const weekNumber = weekIndex + 1
    const weekStart = addDays(startDate, weekIndex * 7)

    const { data: week, error: weekError } = await supabase
      .from('program_weeks')
      .insert({
        program_id: programId,
        week_number: weekNumber,
        theme: WEEK_THEMES[weekIndex],
        starts_on: format(weekStart, 'yyyy-MM-dd'),
      })
      .select('id')
      .single()

    if (weekError) throw weekError

    const dayRows = Array.from({ length: 7 }, (_, i) => ({
      program_id: programId,
      week_id: week.id,
      day_number: weekIndex * 7 + i + 1,
      date: format(addDays(weekStart, i), 'yyyy-MM-dd'),
    }))

    const { error: daysError } = await supabase
      .from('program_days')
      .insert(dayRows)

    if (daysError) throw daysError

    const { data: days, error: fetchError } = await supabase
      .from('program_days')
      .select('id, day_number')
      .eq('week_id', week.id)
      .order('day_number')

    if (fetchError) throw fetchError
    if (!days || days.length === 0)
      throw new Error(`Nenhum dia criado para a semana ${weekNumber}`)

    const weekTemplates = buildWeekTemplatePool(
      templates, scores, priorityArea, weekNumber
    )
    const taskRows: Record<string, unknown>[] = []

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex]
      for (const template of weekTemplates) {
        if (!shouldTaskBeOnDay(template.frequency_per_week, dayIndex)) continue
        taskRows.push({
          program_id: programId,
          day_id: day.id,
          user_id: userId,
          template_id: toNullableUuid(template.id),
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

    if (taskRows.length > 0) {
      const { error: tasksError } = await supabase
        .from('program_tasks')
        .insert(taskRows)

      if (tasksError) throw tasksError
    }
  }
}
