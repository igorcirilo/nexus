// src/lib/pendencias.ts
//
// Deteção de pendências e riscos — varre o estado do dia e devolve os sinais
// de "atenção" que o assistente deve mostrar (hábitos por fazer, streak em
// risco, tarefas atrasadas, objetivos parados, transações por categorizar).
//
// Puro e determinístico (mesmo padrão de day-planner.ts / mentor.ts): recebe
// os dados já carregados, não faz IO. A hora entra como parâmetro para ser
// testável sem depender do relógio.

import type { ProgramTask, Goal90, Habit } from '@/types'

export type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

export interface PendenciaInput {
  hour: number
  habits: HabitWithLog[]
  /** Houve algum check-in registado hoje? (qualquer fase) */
  hasCheckinToday: boolean
  streakCurrent: number
  /** Tarefas do programa de dias anteriores ainda pendentes. */
  overdueTasks: ProgramTask[]
  goals: Goal90[]
  /** Data de hoje 'yyyy-MM-dd' — usada para medir há quanto um objetivo está parado. */
  todayISO: string
  /** Nº de transações importadas por categorizar (heurística do /financas). */
  uncategorizedTx: number
}

export type PendenciaSeverity = 'info' | 'warn' | 'risk'

export interface Pendencia {
  id: string
  severity: PendenciaSeverity
  message: string
  ctaLabel?: string
  ctaHref?: string
}

const SEVERITY_ORDER: Record<PendenciaSeverity, number> = { risk: 0, warn: 1, info: 2 }

/** Dias inteiros entre duas datas 'yyyy-MM-dd' (b - a), seguro quanto a fuso. */
function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00`)
  const b = new Date(`${bISO}T12:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function habitDone(h: HabitWithLog): boolean {
  return Boolean(h.habit_logs && h.habit_logs.length > 0 && h.habit_logs[0].completed)
}

/** Deteta as pendências do dia, ordenadas por severidade (risk → warn → info). */
export function detectPendencias(input: PendenciaInput): Pendencia[] {
  const out: Pendencia[] = []
  const pendingHabits = input.habits.filter((h) => h.active && !habitDone(h))
  const anyActivityToday = input.hasCheckinToday || input.habits.some(habitDone)

  // ── Streak em risco (risk) ────────────────────────────────
  // Tem ofensiva ativa, ainda não fez nada hoje e a noite já vai a meio.
  if (input.streakCurrent > 0 && !anyActivityToday && input.hour >= 20) {
    out.push({
      id: 'streak-risco',
      severity: 'risk',
      message: `A tua sequência de ${input.streakCurrent} dias está em risco — ainda não registaste nada hoje.`,
      ctaLabel: 'Fazer check-in',
      ctaHref: '/checkin',
    })
  }

  // ── Hábitos por fazer ao fim do dia (warn) ────────────────
  if (pendingHabits.length > 0 && input.hour >= 18) {
    const n = pendingHabits.length
    out.push({
      id: 'habitos-pendentes',
      severity: 'warn',
      message:
        n === 1
          ? `Falta 1 hábito para fechar o dia: ${pendingHabits[0].name}.`
          : `Faltam ${n} hábitos para fechar o dia.`,
      ctaLabel: 'Ver hábitos',
      ctaHref: '/habitos',
    })
  }

  // ── Tarefas do programa atrasadas (warn) ──────────────────
  if (input.overdueTasks.length > 0) {
    const n = input.overdueTasks.length
    out.push({
      id: 'tarefas-atrasadas',
      severity: 'warn',
      message:
        n === 1
          ? `Tens 1 tarefa do programa por concluir de dias anteriores.`
          : `Tens ${n} tarefas do programa por concluir de dias anteriores.`,
      ctaLabel: 'Ver programa',
      ctaHref: '/programa',
    })
  }

  // ── Objetivos parados (info) ──────────────────────────────
  // Ativo, sem qualquer progresso e criado há ≥ 7 dias.
  for (const g of input.goals) {
    if (g.status !== 'active') continue
    if (g.progress > 0) continue
    if (daysBetween(g.created_at.slice(0, 10), input.todayISO) >= 7) {
      out.push({
        id: `objetivo-parado-${g.id}`,
        severity: 'info',
        message: `O objetivo "${g.title}" está sem progresso há mais de uma semana.`,
        ctaLabel: 'Ver objetivos',
        ctaHref: '/objetivos',
      })
    }
  }

  // ── Transações por categorizar (info) ─────────────────────
  if (input.uncategorizedTx > 0) {
    out.push({
      id: 'transacoes-por-categorizar',
      severity: 'info',
      message:
        input.uncategorizedTx === 1
          ? 'Tens 1 transação importada por categorizar.'
          : `Tens ${input.uncategorizedTx} transações importadas por categorizar.`,
      ctaLabel: 'Rever finanças',
      ctaHref: '/financas',
    })
  }

  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return out
}
