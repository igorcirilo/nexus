// src/lib/home-extras.ts
// Orquestra os SINAIS de todos os domínios do app para a home (Agenda,
// Lembretes, Finanças, Leitura, Corpo, Objetivos) + insight. Tudo read-only e
// defensivo: qualquer falha degrada para vazio, nunca parte a página.

import { format } from 'date-fns'
import {
  getAgendaEvents,
  getReminders,
  getTransactions,
  getBooks,
  getBookProgress,
  getGoals90,
  getHabitActivity,
} from '@/lib/supabase'
import { getWeightLogs } from '@/lib/body'
import { detectGap } from '@/lib/gaps'
import { pickInsight, type InsightMsg } from '@/lib/insight'
import { AREA_META, type HabitArea, type Profile } from '@/types'

export interface AgendaItem {
  time: string | null
  title: string
  color: string
}

export interface DomainStat {
  key: string
  label: string
  value: string
  sub: string | null
  color: string
  href: string
  /** Etiqueta de alerta quando a área pede atenção (ex.: "a apagar"). */
  flag: string | null
}

export interface HomeExtras {
  agenda: AgendaItem[]
  reminder: { title: string } | null
  nextEvent: { title: string; time: string | null } | null
  domains: DomainStat[]
  goal: { title: string; progress: number } | null
  insight: InsightMsg | null
}

const EMPTY: HomeExtras = { agenda: [], reminder: null, nextEvent: null, domains: [], goal: null, insight: null }

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

export async function getHomeExtras(
  userId: string,
  today: string,
  profile: Profile | null,
): Promise<HomeExtras> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const since7 = format(new Date(Date.now() - 6 * 86_400_000), 'yyyy-MM-dd')
  const since30 = format(new Date(Date.now() - 30 * 86_400_000), 'yyyy-MM-dd')

  const [evRes, remRes, txRes, booksRes, goalsRes, weightRes, actRes] = await Promise.allSettled([
    getAgendaEvents(userId, year, month),
    getReminders(userId),
    getTransactions(userId, 1),
    getBooks(userId),
    getGoals90(userId),
    getWeightLogs(userId, 60),
    getHabitActivity(userId, since30),
  ])

  const out: HomeExtras = { ...EMPTY, agenda: [], domains: [] }
  const domains: DomainStat[] = []

  // ── Agenda de hoje ───────────────────────────────────────
  if (evRes.status === 'fulfilled') {
    const todays = (evRes.value as { date: string; time: string | null; title: string; color: string; all_day: boolean }[])
      .filter((e) => e.date === today)
      .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
    out.agenda = todays.slice(0, 3).map((e) => ({ time: e.all_day ? null : e.time, title: e.title, color: e.color || 'var(--gold)' }))
    if (out.agenda.length > 0) out.nextEvent = { title: out.agenda[0].title, time: out.agenda[0].time }
  }

  // ── Próximo lembrete ativo ───────────────────────────────
  if (remRes.status === 'fulfilled') {
    const active = (remRes.value as { title: string; active: boolean; time: string | null }[])
      .filter((r) => r.active !== false)
      .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
    if (active.length > 0) out.reminder = { title: active[0].title }
  }

  // ── Finanças: livre este mês (entradas − saídas) ─────────
  if (txRes.status === 'fulfilled') {
    const tx = txRes.value as { type: string; amount: unknown }[]
    if (tx.length > 0) {
      const net = tx.reduce((s, t) => s + (t.type === 'entrada' ? num(t.amount) : -num(t.amount)), 0)
      domains.push({
        key: 'financas',
        label: net >= 0 ? 'Finanças · livre este mês' : 'Finanças · este mês',
        value: `${net < 0 ? '−' : ''}€${Math.abs(Math.round(net))}`,
        sub: null,
        color: AREA_META.financas.color,
        href: '/financas',
        flag: net < 0 ? 'no vermelho' : null,
      })
    }
  }

  // ── Leitura: continua o livro mais recente ───────────────
  if (booksRes.status === 'fulfilled') {
    const books = booksRes.value as { id: string; title: string }[]
    if (books.length > 0) {
      const book = books[0]
      let pct = 0
      try {
        const prog = await getBookProgress(book.id, userId)
        pct = prog ? Math.round(num((prog as { progress_pct: unknown }).progress_pct)) : 0
      } catch { /* sem progresso ainda */ }
      domains.push({
        key: 'leitura',
        label: 'Leitura · continua',
        value: book.title,
        sub: pct > 0 ? `${pct}% lido` : 'a começar',
        color: AREA_META.idiomas.color,
        href: '/leitura',
        flag: null,
      })
    }
  }

  // ── Corpo: peso + tendência ──────────────────────────────
  if (weightRes.status === 'fulfilled') {
    const logs = weightRes.value as { date: string; weight_kg: number }[]
    const last = logs.length > 0 ? logs[logs.length - 1] : null
    const current = last ? num(last.weight_kg) : (profile?.weight_kg ?? null)
    if (current != null) {
      const first = logs.length > 1 ? num(logs[0].weight_kg) : current
      const delta = current - first
      const arrow = delta < -0.05 ? '↘' : delta > 0.05 ? '↗' : '→'
      domains.push({
        key: 'corpo',
        label: 'Corpo · peso',
        value: `${current.toFixed(1).replace('.', ',')} kg`,
        sub: logs.length > 1 ? `${arrow} ${Math.abs(delta).toFixed(1).replace('.', ',')}` : null,
        color: AREA_META.corpo.color,
        href: '/corpo',
        flag: null,
      })
    }
  }

  // ── Lacuna do mentor (área deixada cair) vira chip com alerta ──
  const completionsByArea: Partial<Record<HabitArea, number>> = {}
  let total7d = 0
  if (actRes.status === 'fulfilled') {
    const { habits, logs } = actRes.value
    const areaByHabit = new Map(habits.map((h) => [h.id, h.area]))
    for (const l of logs) {
      if (l.date >= since7) {
        const area = areaByHabit.get(l.habit_id)
        if (area) {
          completionsByArea[area] = (completionsByArea[area] ?? 0) + 1
          total7d++
        }
      }
    }
    const gap = detectGap(habits, logs, today)
    if (gap) {
      const meta = AREA_META[gap.area]
      domains.push({
        key: `gap-${gap.area}`,
        label: `${meta?.label ?? gap.area} · há ${gap.days} dias`,
        value: 'Retomar',
        sub: gap.habitName,
        color: meta?.color ?? 'var(--emocoes)',
        href: '/habitos',
        flag: 'a apagar',
      })
    }
  }

  // Mostra no máximo 4 domínios; os com alerta primeiro.
  out.domains = domains.sort((a, b) => (b.flag ? 1 : 0) - (a.flag ? 1 : 0)).slice(0, 4)

  // ── Objetivo 90 dias em destaque ─────────────────────────
  if (goalsRes.status === 'fulfilled') {
    const goals = goalsRes.value as { title: string; progress: number }[]
    if (goals.length > 0) out.goal = { title: goals[0].title, progress: num(goals[0].progress) }
  }

  // ── Insight "O Nexus reparou" ────────────────────────────
  let weightDelta: number | null = null
  if (weightRes.status === 'fulfilled') {
    const logs = weightRes.value as { weight_kg: number }[]
    if (logs.length > 1) weightDelta = num(logs[logs.length - 1].weight_kg) - num(logs[0].weight_kg)
  }
  out.insight = pickInsight({
    completionsByArea,
    totalCompletions7d: total7d,
    streak: profile?.streak_current ?? 0,
    weightDelta,
    weightTowardGoal: Boolean(profile?.goal_weight && profile?.weight_kg && profile.goal_weight < profile.weight_kg),
  })

  return out
}
