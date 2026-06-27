import { supabase } from '@/lib/supabase'
import { todayISO, localDateKey } from '@/lib/date'

/**
 * Métricas-resumo das páginas principais, para a grelha 2x3 do Hoje v2.
 * Cada métrica é independente e tolerante a falhas (try/catch) → uma página
 * sem dados devolve null e o card mostra um estado vazio, sem partir o resto.
 */

export interface HojeMetrics {
  corpo: { weightKg: number; deltaKg: number | null } | null
  financas: { netMonth: number } | null
  leitura: { title: string; currentPage: number; pct: number } | null
  agenda: { time: string; title: string } | null
  ritmo: { streak: number; best: number; successPct: number | null }
  objetivo: { title: string; progress: number } | null
}

const empty: HojeMetrics = {
  corpo: null,
  financas: null,
  leitura: null,
  agenda: null,
  ritmo: { streak: 0, best: 0, successPct: null },
  objetivo: null,
}

export async function getHojeMetrics(userId: string): Promise<HojeMetrics> {
  const today = todayISO()
  const monthStart = `${today.slice(0, 7)}-01`
  const since30 = new Date()
  since30.setDate(since30.getDate() - 29)
  const since30Str = localDateKey(since30)

  const [corpo, financas, leitura, agenda, ritmo, objetivo] = await Promise.all([
    metricCorpo(userId),
    metricFinancas(userId, monthStart),
    metricLeitura(userId),
    metricAgenda(userId, today),
    metricRitmo(userId, since30Str),
    metricObjetivo(userId),
  ])

  return { corpo, financas, leitura, agenda, ritmo, objetivo }
}

async function metricCorpo(userId: string): Promise<HojeMetrics['corpo']> {
  try {
    const { data } = await supabase
      .from('body_measurements')
      .select('weight_kg, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(2)
    const rows = (data ?? []) as { weight_kg: number; date: string }[]
    if (rows.length === 0) return null
    const weightKg = Number(rows[0].weight_kg)
    const deltaKg = rows.length > 1 ? Math.round((weightKg - Number(rows[1].weight_kg)) * 10) / 10 : null
    return { weightKg, deltaKg }
  } catch {
    return null
  }
}

async function metricFinancas(userId: string, monthStart: string): Promise<HojeMetrics['financas']> {
  try {
    const { data } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', monthStart)
    const rows = (data ?? []) as { type: string; amount: number }[]
    if (rows.length === 0) return null
    const net = rows.reduce((sum, t) => sum + (t.type === 'entrada' ? Number(t.amount) : -Number(t.amount)), 0)
    return { netMonth: Math.round(net) }
  } catch {
    return null
  }
}

async function metricLeitura(userId: string): Promise<HojeMetrics['leitura']> {
  try {
    const { data: prog } = await supabase
      .from('book_progress')
      .select('current_page, progress_pct, book_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!prog) return null
    const p = prog as { current_page: number; progress_pct: number; book_id: string }
    const { data: book } = await supabase
      .from('books')
      .select('title')
      .eq('id', p.book_id)
      .maybeSingle()
    return {
      title: (book as { title?: string } | null)?.title ?? 'Leitura',
      currentPage: p.current_page,
      pct: Math.round(Number(p.progress_pct)),
    }
  } catch {
    return null
  }
}

async function metricAgenda(userId: string, today: string): Promise<HojeMetrics['agenda']> {
  try {
    const nowHM = new Date().toTimeString().slice(0, 5)
    const { data } = await supabase
      .from('agenda_events')
      .select('title, time, all_day')
      .eq('user_id', userId)
      .eq('date', today)
      .order('time', { ascending: true, nullsFirst: false })
    const rows = (data ?? []) as { title: string; time: string | null; all_day: boolean }[]
    if (rows.length === 0) return null
    // Próximo evento ainda por acontecer hoje; se já passaram todos, mostra o último.
    const upcoming = rows.find((e) => e.all_day || !e.time || e.time.slice(0, 5) >= nowHM) ?? rows[rows.length - 1]
    return {
      time: upcoming.all_day || !upcoming.time ? 'Dia todo' : upcoming.time.slice(0, 5),
      title: upcoming.title,
    }
  } catch {
    return null
  }
}

async function metricRitmo(userId: string, since30Str: string): Promise<HojeMetrics['ritmo']> {
  try {
    const [{ data: prof }, { data: logs }] = await Promise.all([
      supabase.from('profiles').select('streak_current, streak_best').eq('id', userId).maybeSingle(),
      supabase.from('habit_logs').select('date').eq('user_id', userId).eq('completed', true).gte('date', since30Str),
    ])
    const p = (prof as { streak_current?: number; streak_best?: number } | null) ?? {}
    const activeDays = new Set((logs ?? []).map((l: { date: string }) => l.date)).size
    return {
      streak: p.streak_current ?? 0,
      best: p.streak_best ?? 0,
      successPct: Math.round((activeDays / 30) * 100),
    }
  } catch {
    return empty.ritmo
  }
}

async function metricObjetivo(userId: string): Promise<HojeMetrics['objetivo']> {
  try {
    const { data } = await supabase
      .from('goals_90')
      .select('title, progress')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('progress', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    const g = data as { title: string; progress: number | null }
    return { title: g.title, progress: g.progress ?? 0 }
  } catch {
    return null
  }
}
