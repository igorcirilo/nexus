// src/lib/next-action.ts
// "A seguir" — o condutor único da home. Lógica determinística (sem IA): a
// partir do estado real do dia (check-in, energia, hábitos, missão) escolhe
// UMA ação ancorada em dados, nunca um conselho motivacional solto.

import type { DayPhase } from '@/lib/date'

export interface NextActionHabit {
  id: string
  name: string
  done: boolean
}

export interface NextActionInput {
  phase: DayPhase
  /** Se o check-in da fase atual ainda está por fazer. */
  checkinPending: boolean
  /** Energia 1–10 do check-in da manhã (0 = desconhecida). */
  energy: number
  /** Missão definida no check-in (não pedida do zero na home). */
  mission: string | null
  streak: number
  habits: NextActionHabit[]
  nightCheckinDone: boolean
}

export type NextAction =
  // Abre o check-in (alimenta tudo o resto).
  | { kind: 'checkin'; title: string; why: string; ctaLabel: string }
  // Marca um hábito concreto com 1 toque, sem sair da home.
  | { kind: 'habit'; habitId: string; title: string; why: string; ctaLabel: string }
  // Nada por fazer / sem hábitos: encaminha para o progresso.
  | { kind: 'progress'; title: string; why: string; ctaLabel: string }

const CHECKIN_TITLE: Record<DayPhase, string> = {
  manha: 'Começa pelo check-in da manhã',
  tarde: 'Faz o check-in da tarde',
  noite: 'Fecha o dia com o check-in da noite',
}

const CHECKIN_WHY: Record<DayPhase, string> = {
  manha: 'Diz como acordaste — energia, sono e a missão. O dia ajusta-se a ti.',
  tarde: 'Um ponto de situação rápido mantém a tarde no rumo.',
  noite: 'Fecha o dia em 2 min e prepara um arranque melhor amanhã.',
}

/**
 * Escolhe a única ação que conduz a home agora. A ordem é a prioridade:
 * check-in em falta → tudo feito → energia baixa → próximo hábito → fallback.
 */
export function getNextAction(input: NextActionInput): NextAction {
  const { phase, checkinPending, energy, mission, streak, habits, nightCheckinDone } = input
  const undone = habits.filter((h) => !h.done)
  const allDone = habits.length > 0 && undone.length === 0

  // 1. Check-in da fase em falta — é o sinal de que tudo o resto depende.
  if (checkinPending) {
    return { kind: 'checkin', title: CHECKIN_TITLE[phase], why: CHECKIN_WHY[phase], ctaLabel: 'Fazer check-in' }
  }

  // 2. Tudo cumprido — não inventamos tarefas.
  if (allDone) {
    if (phase === 'noite' && nightCheckinDone) {
      return {
        kind: 'progress',
        title: 'Dia fechado. Tudo cumprido.',
        why: 'Os hábitos de hoje estão todos feitos. Vê o teu ritmo da semana.',
        ctaLabel: 'Ver progresso',
      }
    }
    return {
      kind: 'progress',
      title: 'Hábitos de hoje cumpridos.',
      why: 'Já fechaste o anel do dia. O resto é bónus.',
      ctaLabel: 'Ver progresso',
    }
  }

  // 3. Energia baixa — baixa o sarilho: 1 hábito essencial e descansa o resto.
  if (energy > 0 && energy <= 3 && undone.length > 0) {
    const h = undone[0]
    return {
      kind: 'habit',
      habitId: h.id,
      title: `Energia baixa — faz só: ${h.name}`,
      why: 'Hoje basta um gesto. Um hábito essencial mantém o ritmo sem te exigir tudo.',
      ctaLabel: 'Marcar feito',
    }
  }

  // 4. Há hábitos por fazer — propõe o próximo, factual (não um slogan).
  if (undone.length > 0) {
    const h = undone[0]
    const why = mission
      ? `A tua missão: ${mission}`
      : streak >= 7
        ? `${streak} dias seguidos. Mantém o próximo gesto simples.`
        : 'Um de cada vez. Começa pelo que tens mais à mão.'
    return { kind: 'habit', habitId: h.id, title: `A seguir: ${h.name}`, why, ctaLabel: 'Marcar feito' }
  }

  // 5. Sem hábitos configurados — encaminha sem fingir um plano.
  return {
    kind: 'progress',
    title: 'Vamos pôr o dia em movimento',
    why: 'Ainda não há hábitos para hoje. Configura o teu conjunto inicial.',
    ctaLabel: 'Ver progresso',
  }
}
