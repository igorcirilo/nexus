// src/lib/insight.ts
// "O Nexus reparou" (determinístico, sem IA): a partir de agregados reais,
// escolhe UM padrão para ensinar/refletir. É o trabalho ENSINA. Sem dados
// suficientes, devolve null (nada de conselho genérico).

import type { HabitArea } from '@/types'
import { AREA_META } from '@/types'

export interface InsightAggregates {
  /** Conclusões de hábitos nos últimos 7 dias, por área. */
  completionsByArea: Partial<Record<HabitArea, number>>
  totalCompletions7d: number
  streak: number
  /** Variação de peso nos últimos ~30 dias (kg). Negativo = a descer. */
  weightDelta: number | null
  /** Tem objetivo de peso a descer (goal < atual). */
  weightTowardGoal: boolean
}

export interface InsightMsg {
  title: string
  body: string
}

/** Escolhe a melhor observação para hoje, ou null se não houver sinal forte. */
export function pickInsight(a: InsightAggregates): InsightMsg | null {
  // 1. Progresso de peso rumo ao objetivo — sinal tangível e motivador.
  if (a.weightTowardGoal && a.weightDelta != null && a.weightDelta <= -0.3) {
    return {
      title: `Estás a aproximar-te do teu peso-alvo.`,
      body: `Desceste ${Math.abs(a.weightDelta).toFixed(1)} kg no último mês. O método está a funcionar — mantém o ritmo.`,
    }
  }

  // 2. Série longa — reforça a identidade.
  if (a.streak >= 7) {
    return {
      title: `${a.streak} dias seguidos já é identidade, não motivação.`,
      body: 'Estás a tornar-te a pessoa que faz isto sem pensar. É assim que muda de verdade.',
    }
  }

  // 3. Área mais consistente da semana.
  const entries = Object.entries(a.completionsByArea) as [HabitArea, number][]
  if (a.totalCompletions7d >= 4 && entries.length > 0) {
    const [topArea, topCount] = entries.sort((x, y) => y[1] - x[1])[0]
    if (topCount >= 3) {
      return {
        title: `A tua área mais forte esta semana: ${AREA_META[topArea]?.label ?? topArea}.`,
        body: `${topCount} conclusões em 7 dias. Quando uma área embala, é boa altura para puxar outra.`,
      }
    }
  }

  return null
}
