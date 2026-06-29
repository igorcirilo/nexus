// src/lib/ritmo.ts
//
// "Ritmo" é a métrica-herói que substitui o XP. É um score 0–100 que mede a
// taxa de conclusão dos compromissos do utilizador nos últimos dias, com mais
// peso nos dias recentes. Sobe quando aparece e DECAI quando some — a aversão
// à perda é o motor anti-procrastinação. Ao contrário do XP, não é uma moeda
// acumulável nem auto-reportável: mede cumprimento de compromissos objetivos.

import { localDateKey } from '@/lib/date'

export interface RitmoDay {
  /** Nº de hábitos DEVIDOS nesse dia da semana (denominador). */
  habitsTotal: number
  /** Nº de hábitos concluídos nesse dia. */
  habitsDone: number
  /** Se houve check-in (qualquer fase) nesse dia. */
  checkin: boolean
}

/** Janela de dias considerada no cálculo do Ritmo. */
export const RITMO_WINDOW_DAYS = 14
/** Fator de decaimento por dia (1.0 = sem decaimento; <1 dá mais peso a hoje). */
export const RITMO_DECAY = 0.9

/** Pontuação de um único dia em [0,1]. */
export function dayScore(d: RitmoDay): number {
  if (d.habitsTotal > 0) {
    const ratio = Math.min(1, d.habitsDone / d.habitsTotal)
    return 0.7 * ratio + 0.3 * (d.checkin ? 1 : 0)
  }
  // Sem hábitos definidos: o check-in diário sustenta o ritmo sozinho.
  return d.checkin ? 1 : 0
}

/**
 * Constrói a janela de dias do Ritmo (índice 0 = hoje, fuso LOCAL) a partir
 * de dados já indexados por chave de data local 'yyyy-MM-dd'.
 *
 * Parte pura (sem BD) para ser testável: a chave usa componentes locais
 * (localDateKey), alinhada com como a UI grava os logs — evita o off-by-one
 * de agrupar por UTC em fusos negativos.
 *
 * `habitsDue` pode ser um número fixo (mesmo total todos os dias) ou uma função
 * que devolve quantos hábitos são devidos em cada data — para que dias com
 * menos hábitos agendados (ex.: fim de semana) não baixem o Ritmo injustamente.
 */
export function buildRitmoDays(
  now: Date,
  habitsDue: number | ((date: Date) => number),
  doneByDay: Record<string, number>,
  checkinDays: Set<string>,
): RitmoDay[] {
  const arr: RitmoDay[] = []
  for (let i = 0; i < RITMO_WINDOW_DAYS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const ds = localDateKey(d)
    const habitsTotal = typeof habitsDue === 'function' ? habitsDue(d) : habitsDue
    arr.push({ habitsTotal, habitsDone: doneByDay[ds] ?? 0, checkin: checkinDays.has(ds) })
  }
  return arr
}

/**
 * Calcula o Ritmo (0–100) a partir de uma lista de dias ordenada do mais
 * recente (índice 0 = hoje) para o mais antigo.
 */
export function computeRitmo(days: RitmoDay[]): number {
  let num = 0
  let den = 0
  const n = Math.min(days.length, RITMO_WINDOW_DAYS)
  for (let i = 0; i < n; i++) {
    const w = Math.pow(RITMO_DECAY, i)
    num += w * dayScore(days[i])
    den += w
  }
  if (den === 0) return 0
  return Math.round(100 * (num / den))
}
