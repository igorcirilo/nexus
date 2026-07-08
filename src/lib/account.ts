// src/lib/account.ts
// Operações de conta com impacto legal (LGPD/GDPR): apagamento completo dos
// dados do utilizador, reset de progresso e exportação (portabilidade).
//
// IMPORTANTE: a lista USER_DATA_TABLES é a ÚNICA fonte de verdade das tabelas
// que guardam dados pessoais. Ao criar uma tabela nova com `user_id`, adiciona-a
// aqui — caso contrário o "Repor dados" e o "Apagar conta" deixam dados para
// trás (foi exatamente o bug/risco que esta lista resolve).
import { supabase } from '@/lib/supabase'

// Ordem filhos → pais para respeitar foreign keys mesmo sem ON DELETE CASCADE.
export const USER_DATA_TABLES = [
  // Hábitos & rotina
  'habit_logs',
  'habits',
  'checkins',
  'focus_sessions',
  'user_badges',
  // Objetivos
  'goal_milestones',
  'goals_90',
  // Agenda & lembretes
  'reminders',
  'agenda_events',
  'day_item_checks',
  // Finanças
  'transactions',
  // Avaliações / áreas da vida
  'user_assessments',
  'life_area_scores',
  // Corpo (saúde — dados sensíveis)
  'body_measurements',
  'training_entries',
  'training_plans',
  'diet_meals',
  'diet_plans',
  // Leitura
  'book_bookmarks',
  'book_highlights',
  'book_notes',
  'book_progress',
  'reading_sessions',
  'reading_preferences',
  'books',
  // Largar vícios
  'quit_relapses',
  'quit_habits',
  // Programa
  'program_tasks',
  'programs',
  // Gamificação / ligas
  'weekly_challenges',
  'weekly_league_snapshots',
  // Notificações
  'push_subscriptions',
] as const

// Estado de perfil "limpo" pós-reset (mantém a conta, zera o progresso).
export const PROFILE_RESET = {
  level: 1, title: 'Recruta', streak_current: 0, streak_best: 0,
  streak_last_date: null, mission_today: null, energy_today: 5,
  onboarded: false, habit_level: null, program_id: null, onboarding_version: null,
} as const

/**
 * Apaga TODAS as linhas de dados pessoais do utilizador (todas as tabelas com
 * user_id). Não toca na linha de `profiles` nem na conta de auth.
 * Devolve a lista de erros por tabela (vazia = sucesso total).
 */
export async function purgeUserData(userId: string): Promise<{ table: string; message: string }[]> {
  const errors: { table: string; message: string }[] = []
  for (const table of USER_DATA_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    // Ignora "tabela inexistente" (PGRST205 / 42P01): uma tabela opcional que
    // não esteja implantada não deve fazer o reset reportar falha.
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
      errors.push({ table, message: error.message })
    }
  }
  return errors
}

/**
 * "Repor todos os dados": apaga os dados e repõe o perfil para o estado inicial,
 * mantendo a conta ativa. Agora cobre TODAS as tabelas (antes ficavam para trás
 * peso/saúde, treino, dieta, leitura, vícios, etc.).
 */
export async function resetUserData(userId: string): Promise<{ ok: boolean; errors: { table: string; message: string }[] }> {
  const errors = await purgeUserData(userId)
  const { error } = await supabase.from('profiles').update(PROFILE_RESET as Record<string, unknown>).eq('id', userId)
  if (error) errors.push({ table: 'profiles', message: error.message })
  return { ok: errors.length === 0, errors }
}

/**
 * Exporta todos os dados do utilizador num único objeto (portabilidade — LGPD
 * art. 18 / GDPR art. 20). Inclui o perfil e cada tabela de dados.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    _meta: {
      app: 'Nexus',
      exported_at: new Date().toISOString(),
      user_id: userId,
      format: 'json-v1',
    },
  }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  out.profile = profile ?? null
  for (const table of USER_DATA_TABLES) {
    const { data } = await supabase.from(table).select('*').eq('user_id', userId)
    out[table] = data ?? []
  }
  return out
}

/** Dispara o download do export como ficheiro JSON no browser. */
export function downloadUserDataFile(data: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nexus-dados-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Apaga a conta por completo: dados + linha de perfil + utilizador de auth.
 * A remoção do utilizador de auth exige a service_role → corre numa Edge
 * Function (`delete-account`). O cliente invoca-a com o JWT da sessão.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
  if (error) return { ok: false, error: error.message }
  if (data && (data as { error?: string }).error) return { ok: false, error: (data as { error: string }).error }
  return { ok: true }
}
