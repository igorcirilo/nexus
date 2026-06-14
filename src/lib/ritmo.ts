// src/lib/ritmo.ts
//
// "Ritmo" é a métrica-herói que substitui o XP. É um score 0–100 que mede a
// taxa de conclusão dos compromissos do utilizador nos últimos dias, com mais
// peso nos dias recentes. Sobe quando aparece e DECAI quando some — a aversão
// à perda é o motor anti-procrastinação. Ao contrário do XP, não é uma moeda
// acumulável nem auto-reportável: mede cumprimento de compromissos objetivos.

export interface RitmoDay {
  /** Nº de hábitos ativos nesse dia (denominador). */
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
