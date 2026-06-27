// src/lib/mentor-read.ts
// "Leitura do dia" do mentor (determinística, sem IA): uma frase curta que lê o
// estado real (energia, série, hábitos por fazer, próximo evento, lembrete) e
// dá a sensação de "ele já sabe o que importa hoje". É o trabalho ORIENTA.

import type { DayPhase } from '@/lib/date'

export interface MentorReadCtx {
  phase: DayPhase
  energy: number // 1–10 (0 = desconhecida)
  streak: number
  habitsLeft: number
  habitsTotal: number
  nextEvent: { title: string; time: string | null } | null
  reminder: { title: string } | null
}

function hhmm(time: string | null): string {
  if (!time) return ''
  return time.slice(0, 5)
}

function cap(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('pt-PT') + s.slice(1) : s
}

/** Compõe a leitura do dia. Devolve sempre uma frase utilizável. */
export function buildMentorRead(ctx: MentorReadCtx): string {
  const { phase, energy, streak, habitsLeft, habitsTotal, nextEvent, reminder } = ctx

  let opener: string
  if (energy > 0 && energy <= 3) {
    opener = 'Energia baixa hoje — vamos com calma.'
  } else if (streak >= 7) {
    opener = `Série de ${streak} dias e ritmo forte.`
  } else if (streak > 0) {
    opener = `${streak} ${streak === 1 ? 'dia' : 'dias'} em construção.`
  } else if (phase === 'noite') {
    opener = 'Hora de fechar o dia com consciência.'
  } else {
    opener = 'Novo dia para agir.'
  }

  const clauses: string[] = []
  if (habitsTotal > 0 && habitsLeft > 0) {
    clauses.push(`falta${habitsLeft > 1 ? 'm' : ''} ${habitsLeft} hábito${habitsLeft > 1 ? 's' : ''}`)
  } else if (habitsTotal > 0) {
    clauses.push('os hábitos estão todos feitos')
  }
  if (nextEvent) {
    const t = hhmm(nextEvent.time)
    clauses.push(`tens ${nextEvent.title}${t ? ` às ${t}` : ''}`)
  }
  if (reminder) {
    clauses.push(reminder.title.toLocaleLowerCase('pt-PT'))
  }

  if (clauses.length === 0) return opener

  const tail = clauses.length > 1
    ? `${clauses.slice(0, -1).join(', ')} e ${clauses[clauses.length - 1]}`
    : clauses[0]

  return `${opener} ${cap(tail)} — já te organizei o resto.`
}
