// src/lib/weekly.ts
//
// Derivações puras do dashboard semanal (/estatisticas → WeeklyDashboard).
// Extraídas do componente para serem testáveis e para centralizarem a
// definição das métricas — em especial a "taxa de conclusão", que antes vivia
// inline e divergia das outras noções de consistência do app.
//
// Nota sobre as 3 métricas de "consistência" do Nexus (fontes distintas e
// intencionais):
//  • completionRate (aqui)  → concluídos / registados no período.
//  • stats.consistencyPct   → % de dias com ≥1 conclusão.
//  • ritmo.computeRitmo     → concluídos / DEVIDOS, com decaimento temporal.

export interface WeekLog {
  date: string // 'yyyy-MM-dd'
  completed: boolean
}

export interface WeekCheckin {
  date: string // 'yyyy-MM-dd'
  energy?: number | null
  sleep_hours?: number | null
}

/** Conclusões (completed === true) por dia. */
export function completedByDay(logs: WeekLog[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const l of logs) {
    if (l.completed) map[l.date] = (map[l.date] ?? 0) + 1
  }
  return map
}

/** Nº de check-ins por dia. */
export function checkinsByDay(checkins: WeekCheckin[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const c of checkins) map[c.date] = (map[c.date] ?? 0) + 1
  return map
}

/**
 * Taxa de conclusão (0–100): concluídos / total de hábitos registados no
 * conjunto. Mede a execução entre os hábitos que o utilizador tocou (não entre
 * os devidos — para isso existe o Ritmo).
 */
export function completionRate(logs: WeekLog[]): number {
  if (logs.length === 0) return 0
  const done = logs.filter((l) => l.completed).length
  return Math.round((done / logs.length) * 100)
}

/**
 * Média de um campo numérico dos check-ins, ignorando null/undefined (mas
 * contando o 0 como valor legítimo), arredondada a 1 casa decimal.
 */
export function averageCheckin(
  checkins: WeekCheckin[],
  field: 'energy' | 'sleep_hours',
): number {
  const vals = checkins
    .map((c) => c[field])
    .filter((v): v is number => v != null)
  if (vals.length === 0) return 0
  const avg = vals.reduce((a, v) => a + v, 0) / vals.length
  return Math.round(avg * 10) / 10
}

/**
 * Total de atividades (conclusões de hábito + check-ins) do conjunto.
 * É o número usado na tendência semana-a-semana.
 */
export function activityCount(logs: WeekLog[], checkins: WeekCheckin[]): number {
  const done = logs.filter((l) => l.completed).length
  return done + checkins.length
}
