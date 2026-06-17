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

/** Data local de hoje no formato 'yyyy-MM-dd' (fuso do dispositivo). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Faz parse de uma data 'yyyy-MM-dd' ancorada ao meio-dia LOCAL.
 * Use sempre que precisar transformar uma string de data num Date para exibir.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

/** Formata uma string de data 'yyyy-MM-dd' de forma segura quanto a fuso. */
export function formatLocalDate(
  dateStr: string,
  fmt: string,
  options?: Parameters<typeof format>[2],
): string {
  return format(parseLocalDate(dateStr), fmt, options)
}
