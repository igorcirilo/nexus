import type { HabitArea } from '@/types'

/**
 * Catálogo de hábitos usado pelo gerador de onboarding (assessment-to-habits).
 * Cada entrada tem uma `key` estável (gravada em habits.catalog_key) que permite
 * regenerar/ajustar o conjunto sem duplicar nem perder logs.
 */

export type CatalogDifficulty = 1 | 2 | 3

export interface CatalogHabit {
  key: string
  area: HabitArea
  name: string
  difficulty: CatalogDifficulty
  /** Janela por omissão. Se `flexible`, é substituída pela janela de pico do user (b7_rotina). */
  time_window: string | null
  flexible?: boolean
}

/** XP por dificuldade (reutiliza a convenção de habitos/page.tsx DIFFICULTY_XP). */
export const XP_BY_DIFFICULTY: Record<CatalogDifficulty, number> = { 1: 8, 2: 15, 3: 24 }

/** b7_rotina → janela de tempo aplicada aos hábitos flexíveis. */
export const ROUTINE_WINDOW: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  variado: 'Qualquer hora',
}

export const HABIT_CATALOG: Record<HabitArea, CatalogHabit[]> = {
  corpo: [
    { key: 'corpo_agua', area: 'corpo', name: 'Beber 2L de água', difficulty: 1, time_window: 'Todo o dia' },
    { key: 'corpo_caminhada', area: 'corpo', name: 'Caminhada de 20 min', difficulty: 1, time_window: 'Manhã', flexible: true },
    { key: 'corpo_along', area: 'corpo', name: 'Alongamento + mobilidade', difficulty: 2, time_window: 'Fim do dia', flexible: true },
    { key: 'corpo_treino', area: 'corpo', name: 'Treino completo', difficulty: 3, time_window: '07:00-08:30' },
  ],
  produtividade: [
    { key: 'prod_planeardia', area: 'produtividade', name: 'Planear o dia (5 min)', difficulty: 1, time_window: 'Manhã', flexible: true },
    { key: 'prod_foco50', area: 'produtividade', name: 'Bloco de foco 50 min', difficulty: 2, time_window: 'Manhã', flexible: true },
    { key: 'prod_tarefaprinc', area: 'produtividade', name: 'Fechar a tarefa principal do dia', difficulty: 3, time_window: 'Tarde', flexible: true },
  ],
  idiomas: [
    { key: 'idio_licao', area: 'idiomas', name: 'Lição de idioma 15 min', difficulty: 1, time_window: 'Noite', flexible: true },
    { key: 'idio_revisao', area: 'idiomas', name: 'Revisão de vocabulário', difficulty: 2, time_window: 'Almoço', flexible: true },
    { key: 'idio_conversa', area: 'idiomas', name: 'Conversação 30 min', difficulty: 3, time_window: 'Noite', flexible: true },
  ],
  carreira: [
    { key: 'carr_cv', area: 'carreira', name: 'Atualizar CV ou LinkedIn', difficulty: 1, time_window: 'Fim do dia', flexible: true },
    { key: 'carr_leitura', area: 'carreira', name: 'Leitura técnica 20 min', difficulty: 2, time_window: 'Noite', flexible: true },
    { key: 'carr_projeto', area: 'carreira', name: 'Avançar projeto / portfólio', difficulty: 3, time_window: 'Tarde', flexible: true },
  ],
  financas: [
    { key: 'fin_registar', area: 'financas', name: 'Registar gastos do dia', difficulty: 1, time_window: 'Noite', flexible: true },
    { key: 'fin_revisao', area: 'financas', name: 'Revisão semanal de contas', difficulty: 2, time_window: 'Domingo' },
    { key: 'fin_estudo', area: 'financas', name: 'Estudo de investimento', difficulty: 3, time_window: 'Noite', flexible: true },
  ],
  emocoes: [
    { key: 'emo_respiracao', area: 'emocoes', name: 'Respiração guiada 5 min', difficulty: 1, time_window: 'Manhã', flexible: true },
    { key: 'emo_journaling', area: 'emocoes', name: 'Journaling emocional', difficulty: 2, time_window: 'Noite', flexible: true },
    { key: 'emo_meditacao', area: 'emocoes', name: 'Meditação 20 min', difficulty: 3, time_window: 'Fim do dia', flexible: true },
  ],
  relacionamentos: [
    { key: 'rel_mensagem', area: 'relacionamentos', name: 'Mensagem a alguém importante', difficulty: 1, time_window: 'Tarde', flexible: true },
    { key: 'rel_chamada', area: 'relacionamentos', name: 'Chamada de 15 min', difficulty: 2, time_window: 'Noite', flexible: true },
    { key: 'rel_qualidade', area: 'relacionamentos', name: 'Tempo de qualidade sem telemóvel', difficulty: 3, time_window: 'Jantar' },
  ],
}

/**
 * Hábitos anti-procrastinação ligados às barreiras de b4_travas.
 * São fáceis (difficulty 1) e entram nos primeiros slots para criar tração.
 */
export const BARRIER_HABITS: Record<string, CatalogHabit> = {
  procrastina: { key: 'barr_2min', area: 'produtividade', name: 'Regra dos 2 minutos', difficulty: 1, time_window: 'Qualquer hora' },
  tempo: { key: 'prod_planeardia', area: 'produtividade', name: 'Planear o dia (5 min)', difficulty: 1, time_window: 'Manhã', flexible: true },
  motivacao: { key: 'barr_vitoria', area: 'emocoes', name: '1 vitória do dia', difficulty: 1, time_window: 'Noite', flexible: true },
}

/** Aplica a janela de pico (b7_rotina) a um hábito flexível. */
export function applyRoutineWindow(habit: CatalogHabit, routine: string | undefined): string | null {
  if (habit.flexible && routine && ROUTINE_WINDOW[routine]) return ROUTINE_WINDOW[routine]
  return habit.time_window
}
