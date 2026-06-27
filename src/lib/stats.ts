import { supabase } from '@/lib/supabase'
import { localDateKey, todayISO } from '@/lib/date'

/**
 * Estatísticas de consistência — fetch + derivações puras para a página
 * Estatísticas (registos, heatmap, barras de 7 dias). As funções de derivação
 * são puras e testáveis sem BD (recebem o mapa de conclusões por dia).
 */

export interface ActivityStats {
  /** conclusões (completed=true) por dia: 'yyyy-MM-dd' → contagem. */
  byDate: Record<string, number>
  /** nº de hábitos ativos (capacidade diária para níveis/barras). */
  activeHabits: number
  windowDays: number
}

/** Busca conclusões dos últimos `days` dias + nº de hábitos ativos. */
export async function getActivityStats(userId: string, days = 63): Promise<ActivityStats> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = localDateKey(since)
  const [{ data: logs }, { data: habits }] = await Promise.all([
    supabase.from('habit_logs').select('date').eq('user_id', userId).eq('completed', true).gte('date', sinceStr),
    supabase.from('habits').select('id').eq('user_id', userId).eq('active', true),
  ])
  const byDate: Record<string, number> = {}
  for (const l of (logs ?? []) as { date: string }[]) {
    byDate[l.date] = (byDate[l.date] ?? 0) + 1
  }
  return { byDate, activeHabits: (habits ?? []).length, windowDays: days }
}

/** Lista de chaves de data 'yyyy-MM-dd' dos últimos `days` (mais antigo → hoje). */
export function lastDays(days: number, today: string = todayISO()): string[] {
  const base = new Date(`${today}T12:00:00`)
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    out.push(localDateKey(d))
  }
  return out
}

/**
 * Nível 0–4 de cada dia para o heatmap (mais antigo → hoje).
 * Nível por rácio conclusões/hábitos ativos; sem hábitos, usa o máximo do período.
 */
export function heatmapLevels(stats: ActivityStats, today: string = todayISO()): number[] {
  const days = lastDays(stats.windowDays, today)
  const denom = stats.activeHabits > 0
    ? stats.activeHabits
    : Math.max(1, ...days.map((d) => stats.byDate[d] ?? 0))
  return days.map((d) => {
    const c = stats.byDate[d] ?? 0
    if (c === 0) return 0
    const ratio = Math.min(1, c / denom)
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  })
}

/** Barras dos últimos 7 dias: label do dia + percentagem (0–100). */
export function last7Bars(stats: ActivityStats, today: string = todayISO()): { label: string; pct: number; isToday: boolean }[] {
  const days = lastDays(7, today)
  const denom = stats.activeHabits > 0 ? stats.activeHabits : Math.max(1, ...days.map((d) => stats.byDate[d] ?? 0))
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  return days.map((d, i) => {
    const c = stats.byDate[d] ?? 0
    return {
      label: i === days.length - 1 ? 'hoje' : wd[new Date(`${d}T12:00:00`).getDay()],
      pct: Math.min(100, Math.round((c / denom) * 100)),
      isToday: i === days.length - 1,
    }
  })
}

/** Percentagem de dias com ≥1 conclusão nos últimos `days`. */
export function consistencyPct(stats: ActivityStats, days = 30, today: string = todayISO()): number {
  const window = lastDays(Math.min(days, stats.windowDays), today)
  const active = window.filter((d) => (stats.byDate[d] ?? 0) > 0).length
  return Math.round((active / window.length) * 100)
}

/** Total de conclusões em todo o período. */
export function totalCompletions(stats: ActivityStats): number {
  return Object.values(stats.byDate).reduce((a, b) => a + b, 0)
}
