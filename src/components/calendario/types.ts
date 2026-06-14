import type { CSSProperties } from 'react'
import { format, subDays, addDays } from 'date-fns'
import type { AgendaEvent } from '@/lib/supabase'
import type { HabitArea } from '@/types'
import type { IconName } from '@/components/ui/Icon'

export type DayStatus = { habits: number; total: number; checkins: number; complete: boolean }
export type CalendarTab = 'calendario' | 'checkin' | 'lembretes' | 'agenda'
export type ViewMode = 'month' | 'week'
export type StreakSide = 'start' | 'middle' | 'end' | 'solo' | null
export type Recurrence = 'none' | 'diario' | 'semanal' | 'mensal'
export type Reminder = { id: string; title: string; time: string; days: number[]; active: boolean; type: string }
export type Checkin = {
  phase: string
  energy?: number
  sleep_hours?: number
  mood?: number
  mission?: string
  win_of_day?: string
}
export type HabitRow = {
  id: string
  name: string
  area: HabitArea
  habit_logs: { completed: boolean }[]
}
export type WeekdayStat = { weekday: number; done: number; total: number }
export type { AgendaEvent }

export const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DAYS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const DAYS_PT_PREP = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados']
export const PHASE_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
export const PHASE_ICONS: Record<string, IconName> = { manha: 'sunrise', tarde: 'sun', noite: 'moon' }
export const EVENT_COLORS = ['#E8A838', '#1ECBB4', '#7F77DD', '#E24B4A', '#1D9E75', '#D4537E', '#85B7EB']

export const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '11px 14px',
  color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 14,
  outline: 'none',
}

export function heatColor(status: DayStatus | undefined): string {
  if (!status || status.habits === 0) return 'transparent'
  if (status.complete) return 'var(--teal)'
  const intensity = Math.min(status.habits, 5) / 5
  if (intensity >= 0.8) return 'rgba(30,203,180,.65)'
  if (intensity >= 0.6) return 'rgba(30,203,180,.45)'
  if (intensity >= 0.4) return 'rgba(30,203,180,.28)'
  if (intensity >= 0.2) return 'rgba(30,203,180,.14)'
  return 'rgba(232,168,56,.2)'
}

export function heatTextColor(status: DayStatus | undefined, isTodayDate: boolean, isSelected: boolean): string {
  if (status?.complete) return 'var(--bg0)'
  if (isTodayDate) return 'var(--gold)'
  if (isSelected) return 'var(--accent)'
  return 'var(--text2)'
}

export function getStreakSide(dateStr: string, dayMap: Record<string, DayStatus>): StreakSide {
  const hasThis = (dayMap[dateStr]?.habits ?? 0) > 0
  if (!hasThis) return null
  const date = new Date(`${dateStr}T12:00:00`)
  const prev = format(subDays(date, 1), 'yyyy-MM-dd')
  const next = format(addDays(date, 1), 'yyyy-MM-dd')
  const hasPrev = (dayMap[prev]?.habits ?? 0) > 0
  const hasNext = (dayMap[next]?.habits ?? 0) > 0
  if (hasPrev && hasNext) return 'middle'
  if (hasPrev) return 'end'
  if (hasNext) return 'start'
  return 'solo'
}

export function computeCurrentStreak(dayMap: Record<string, DayStatus>): number {
  let streak = 0
  let date = new Date()
  while (streak < 400) {
    const dateStr = format(date, 'yyyy-MM-dd')
    if ((dayMap[dateStr]?.habits ?? 0) > 0) {
      streak++
      date = subDays(date, 1)
    } else {
      break
    }
  }
  return streak
}

export function streakBarStyle(side: StreakSide): CSSProperties {
  if (!side) return { display: 'none' }
  const base: CSSProperties = { position: 'absolute', bottom: 0, height: 3, background: 'rgba(30,203,180,.8)' }
  if (side === 'solo') return { ...base, left: 4, right: 4, borderRadius: 3 }
  if (side === 'start') return { ...base, left: 4, right: 0, borderRadius: '3px 0 0 3px' }
  if (side === 'end') return { ...base, left: 0, right: 4, borderRadius: '0 3px 3px 0' }
  return { ...base, left: 0, right: 0, borderRadius: 0 }
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getPatternInsights(patterns: WeekdayStat[]): string[] {
  const withData = patterns.filter(pattern => pattern.total >= 2)
  if (withData.length < 3) return []
  const withPct = withData.map(pattern => ({ ...pattern, pct: Math.round((pattern.done / pattern.total) * 100) }))
  withPct.sort((a, b) => b.pct - a.pct)
  const insights: string[] = []
  const best = withPct[0]
  const worst = withPct[withPct.length - 1]
  if (best.pct >= 50) {
    insights.push(`${capitalize(DAYS_PT_PREP[best.weekday])} és ${best.pct}% consistente — o teu melhor dia.`)
  }
  if (worst.pct < best.pct && worst.weekday !== best.weekday) {
    insights.push(`${capitalize(DAYS_PT_PREP[worst.weekday])} costumas falhar mais (${worst.pct}%).`)
  }
  const diff = best.pct - worst.pct
  if (diff >= 35 && insights.length >= 2) {
    insights.push(`Diferença de ${diff}% entre o teu melhor e pior dia — há margem para crescer.`)
  }
  return insights
}

export function describeDayStatus(status: DayStatus | undefined, hasEvents: boolean): string {
  if (!status && !hasEvents) return 'sem registos'
  const parts: string[] = []
  if (status?.complete) parts.push('dia completo')
  if (status?.habits) parts.push(`${status.habits} hábitos`)
  if (status?.checkins) parts.push(`${status.checkins} check-ins`)
  if (hasEvents) parts.push('com eventos')
  return parts.join(', ') || 'sem registos'
}
