// src/lib/gaps.ts
// Mentor de lacuna (determinístico, sem IA): deteta a área/hábito que o
// utilizador deixou cair há mais tempo e propõe retomá-lo. Uma lacuna de cada
// vez, com o porquê — nunca conselho genérico.

import type { HabitArea } from '@/types'
import { parseLocalDate } from '@/lib/date'

/** A partir de quantos dias sem atividade consideramos que há uma lacuna. */
export const GAP_THRESHOLD_DAYS = 7

export interface HabitActivityRow {
  id: string
  name: string
  area: HabitArea
  created_at: string
}

export interface Gap {
  habitId: string
  habitName: string
  area: HabitArea
  days: number
}

function dayDiff(fromStr: string, toStr: string): number {
  const from = parseLocalDate(fromStr).getTime()
  const to = parseLocalDate(toStr).getTime()
  return Math.floor((to - from) / 86_400_000)
}

/**
 * Devolve a maior lacuna entre os hábitos ativos, ou null se não houver
 * nenhuma relevante. Só conta hábitos com idade suficiente para a lacuna ser
 * real (evita falsos positivos em utilizadores novos).
 */
export function detectGap(
  habits: HabitActivityRow[],
  logs: { habit_id: string; date: string }[],
  today: string,
): Gap | null {
  // Última data concluída por hábito.
  const lastByHabit = new Map<string, string>()
  for (const l of logs) {
    const cur = lastByHabit.get(l.habit_id)
    if (!cur || l.date > cur) lastByHabit.set(l.habit_id, l.date)
  }

  let best: Gap | null = null
  for (const h of habits) {
    const createdKey = (h.created_at ?? '').slice(0, 10)
    if (!createdKey) continue
    // O hábito tem de existir há tempo suficiente para se poder falhar.
    if (dayDiff(createdKey, today) < GAP_THRESHOLD_DAYS) continue

    // Referência: última conclusão; se nunca concluído, a data de criação.
    const last = lastByHabit.get(h.id)
    const days = dayDiff(last ?? createdKey, today)
    if (days < GAP_THRESHOLD_DAYS) continue

    if (!best || days > best.days) {
      best = { habitId: h.id, habitName: h.name, area: h.area, days }
    }
  }

  return best
}
