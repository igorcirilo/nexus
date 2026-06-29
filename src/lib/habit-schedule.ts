// src/lib/habit-schedule.ts
// Agendamento de hábitos: ordenação por horário do dia e frequência por dia da
// semana. Funções puras (testáveis sem BD). Convenção de dia da semana igual à
// do JS Date.getDay() e à coluna reminders.days: 0=Domingo … 6=Sábado.

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Presets de frequência. days vazio/null = todos os dias.
export const WEEKDAYS_ALL = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS_WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKDAYS_WEEKEND = [0, 6]

// Rótulos de período usados nos time_window não-numéricos, mapeados para o
// minuto aproximado de início (para ordenar manhã → noite).
const LABEL_MINUTES: Record<string, number> = {
  madrugada: 5 * 60,
  manha: 8 * 60,
  manhã: 8 * 60,
  'inicio da manha': 7 * 60,
  almoco: 12 * 60,
  almoço: 12 * 60,
  tarde: 15 * 60,
  'fim da tarde': 17 * 60,
  'fim do dia': 18 * 60,
  jantar: 20 * 60,
  noite: 21 * 60,
}

// Hábitos sem hora específica vão para o fim (depois dos agendados por hora).
const ALL_DAY_KEY = 24 * 60 + 1
const UNKNOWN_KEY = 24 * 60 + 2

/**
 * Minuto de início (desde a meia-noite) para ordenar um time_window.
 * Aceita intervalos ("07:00-09:00"), horas soltas ("18:00") e rótulos
 * ("Manhã", "Noite", "Todo o dia"). Desconhecido/none → fim da lista.
 */
export function timeWindowSortKey(timeWindow: string | null | undefined): number {
  if (!timeWindow) return UNKNOWN_KEY
  const tw = timeWindow.trim().toLowerCase()
  // Primeira hora no formato HH:MM encontrada.
  const m = tw.match(/(\d{1,2}):(\d{2})/)
  if (m) {
    const h = Number(m[1]); const min = Number(m[2])
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min
  }
  if (tw === 'todo o dia' || tw === 'dia todo' || tw === 'qualquer hora') return ALL_DAY_KEY
  if (tw in LABEL_MINUTES) return LABEL_MINUTES[tw]
  return UNKNOWN_KEY
}

/** Ordena hábitos por horário do dia (manhã → noite), desempatando por nome. */
export function sortByTimeWindow<T extends { time_window: string | null; name: string }>(habits: T[]): T[] {
  return [...habits].sort((a, b) => {
    const ka = timeWindowSortKey(a.time_window)
    const kb = timeWindowSortKey(b.time_window)
    if (ka !== kb) return ka - kb
    return a.name.localeCompare(b.name, 'pt')
  })
}

/** Normaliza o campo days: trata null/[]/0..6 com segurança. */
export function normalizeDays(days: number[] | null | undefined): number[] | null {
  if (!days || days.length === 0) return null
  const set = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
  // Todos os 7 dias = "todos os dias" → guardamos null (semântica canónica).
  return set.length === 0 || set.length === 7 ? null : set
}

/** O hábito está agendado para esta data? (days null/vazio = todos os dias) */
export function isHabitDueOn(days: number[] | null | undefined, date: Date): boolean {
  const norm = normalizeDays(days)
  if (!norm) return true
  return norm.includes(date.getDay())
}

/** Rótulo curto da frequência para mostrar na UI. */
export function frequencyLabel(days: number[] | null | undefined): string {
  const norm = normalizeDays(days)
  if (!norm) return 'Todos os dias'
  if (norm.length === 5 && WEEKDAYS_WEEKDAYS.every((d) => norm.includes(d))) return 'Dias úteis'
  if (norm.length === 2 && WEEKDAYS_WEEKEND.every((d) => norm.includes(d))) return 'Fim de semana'
  if (norm.length === 1) return WEEKDAYS_FULL[norm[0]]
  return `${norm.length}x · ${norm.map((d) => WEEKDAYS_SHORT[d]).join(', ')}`
}
