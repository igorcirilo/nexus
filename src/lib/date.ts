import { format } from 'date-fns'

/**
 * Fonte única de verdade para datas no Nexus.
 *
 * Regra geral:
 * - "Hoje" é sempre o dia no fuso do dispositivo do utilizador (todayISO).
 * - Datas guardadas como 'yyyy-MM-dd' devem ser lidas com parseLocalDate,
 *   que ancora ao meio-dia LOCAL e evita o off-by-one de new Date('yyyy-MM-dd')
 *   (que o JS interpreta como meia-noite UTC e desloca o dia em fusos negativos).
 */

/** Chave de data LOCAL 'yyyy-MM-dd' para um Date (componentes do fuso local). */
export function localDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Data local de hoje no formato 'yyyy-MM-dd' (fuso do dispositivo). */
export function todayISO(): string {
  return localDateKey(new Date())
}

/**
 * Faz parse de uma data 'yyyy-MM-dd' ancorada ao meio-dia LOCAL.
 * Use sempre que precisar transformar uma string de data num Date para exibir.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

export type DayPhase = 'manha' | 'tarde' | 'noite'

/**
 * Fase do dia a partir da hora (0–23). Fonte única de verdade para os limites
 * manhã/tarde/noite, partilhada pelo Hoje (mentor) e pelo check-in.
 * Limites: manhã < 12, tarde < 18, noite caso contrário.
 */
export function phaseForHour(hour: number): DayPhase {
  if (hour < 12) return 'manha'
  if (hour < 18) return 'tarde'
  return 'noite'
}

/** Formata uma string de data 'yyyy-MM-dd' de forma segura quanto a fuso. */
export function formatLocalDate(
  dateStr: string,
  fmt: string,
  options?: Parameters<typeof format>[2],
): string {
  return format(parseLocalDate(dateStr), fmt, options)
}
