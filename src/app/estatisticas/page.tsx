'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { supabase, getProfile } from '@/lib/supabase'
import {
  getActivityStats,
  heatmapLevels,
  last7Bars,
  consistencyPct,
  totalCompletions,
  lastDays,
  type ActivityStats,
} from '@/lib/stats'
import { AREA_META } from '@/types'
import { localDateKey } from '@/lib/date'
import WeeklyDashboard from '@/components/estatisticas/WeeklyDashboard'
import type { Profile, HabitArea } from '@/types'

const FONT = 'Inter, sans-serif'
const HEAT = ['rgba(var(--ink-rgb),0.05)', 'rgba(232,168,56,0.28)', 'rgba(232,168,56,0.5)', 'rgba(232,168,56,0.72)', '#E8A838']

type AreaRow = { key: string; label: string; icon: string; color: string; pct: number }

export default function EstatisticasPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = '/auth'
        return
      }
      const since28 = new Date()
      since28.setDate(since28.getDate() - 27)
      const [prof, s, { data: habits }, { data: logs28 }] = await Promise.all([
        getProfile(user.id),
        getActivityStats(user.id, 63),
        supabase.from('habits').select('id, area').eq('user_id', user.id).eq('active', true),
        supabase.from('habit_logs').select('habit_id, completed, date').eq('user_id', user.id).eq('completed', true).gte('date', localDateKey(since28)),
      ])
      setProfile(prof as Profile)
      setUserId(user.id)
      setStats(s)
      setAreas(computeAreas((habits ?? []) as { id: string; area: string }[], (logs28 ?? []) as { habit_id: string }[]))
      setLoading(false)
    })
  }, [])

  const levels = useMemo(() => (stats ? heatmapLevels(stats) : []), [stats])
  const bars = useMemo(() => (stats ? last7Bars(stats) : []), [stats])
  const months = useMemo(() => monthsInWindow(63), [])
  const success = stats ? consistencyPct(stats, 30) : 0
  const total = stats ? totalCompletions(stats) : 0

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: 'var(--surface-page)', fontFamily: FONT }}>
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 0 4px' }}>
          <Link href="/hoje" aria-label="Voltar" style={backBtn}>‹</Link>
          <div>
            <h1 style={{ fontSize: 25, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.4px' }}>Estatísticas</h1>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>A tua consistência ao longo do tempo</div>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>A carregar…</div>
        ) : (
          <>
            {/* Registos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
              <RegCard emoji="🔥" value={profile?.streak_current ?? 0} label="SEQUÊNCIA ATUAL" color="#E8A838" />
              <RegCard emoji="🏆" value={profile?.streak_best ?? 0} label="MELHOR SEQUÊNCIA" color="#1ECBB4" />
              <RegCard emoji="📊" value={`${success}%`} label="SUCESSO · 30 DIAS" color="#9C94EC" />
            </div>

            {/* Heatmap */}
            <SecTitle>Mapa de consistência</SecTitle>
            <div style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Últimas 9 semanas</b>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>{total} conclusões</span>
              </div>
              <div style={{ display: 'flex', gap: 5, fontSize: 9, color: 'var(--text3)', fontWeight: 700, margin: '0 0 6px 2px' }}>
                {months.map((m) => <span key={m} style={{ width: 62 }}>{m}</span>)}
              </div>
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(7,1fr)', gridAutoFlow: 'column', gridAutoColumns: 13, gap: 4 }}>
                {levels.map((lv, i) => (
                  <span key={i} style={{ width: 13, height: 13, borderRadius: 4, background: HEAT[lv] }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 12, fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>
                menos {HEAT.map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />)} mais
              </div>
            </div>

            {/* Barras 7 dias */}
            <SecTitle>Últimos 7 dias</SecTitle>
            <div style={panel}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, padding: '0 4px' }}>
                {bars.map((b, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: 34 }}>
                    <div style={{ width: 13, height: 96, background: 'var(--surface-3)', borderRadius: 7, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                      <i style={{ width: '100%', height: `${Math.max(b.pct, 4)}%`, borderRadius: 7, background: 'linear-gradient(180deg,#F2C45A,#E8A838)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: b.isToday ? '#E8A838' : 'var(--text2)' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Áreas da vida (últimos 28 dias) */}
            {areas.length > 0 && (
              <>
                <SecTitle>Áreas da vida · 28 dias</SecTitle>
                <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {areas.map((a) => (
                    <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text1)', minWidth: 96, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${a.pct}%`, borderRadius: 10, background: a.color }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', minWidth: 30, textAlign: 'right' }}>{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Dashboard semanal (gráficos detalhados) — abre num botão */}
            <SecTitle>Dashboard semanal</SecTitle>
            {showDashboard && userId ? (
              <WeeklyDashboard userId={userId} streakCurrent={profile?.streak_current ?? 0} />
            ) : (
              <button
                onClick={() => setShowDashboard(true)}
                style={{
                  width: '100%', background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.08)',
                  borderRadius: 16, padding: '16px', cursor: 'pointer', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>📊</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>Ver dashboard detalhado</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Atividade, energia, sono e resumo da semana</span>
                </span>
                <span style={{ fontSize: 18, color: 'var(--text3)' }}>›</span>
              </button>
            )}
          </>
        )}
      </div>
      <Nav />
    </main>
  )
}

function RegCard({ emoji, value, label, color }: { emoji: string; value: number | string; label: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 18, padding: '15px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 19 }}>{emoji}</div>
      <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.5px', marginTop: 6, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: '24px 4px 12px', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)' }}>{children}</div>
}

/** Progresso por área (últimos 28 dias) a partir dos hábitos e conclusões. */
function computeAreas(habits: { id: string; area: string }[], logs: { habit_id: string }[]): AreaRow[] {
  const idsByArea: Record<string, string[]> = {}
  for (const h of habits) (idsByArea[h.area] ??= []).push(h.id)
  const doneByHabit: Record<string, number> = {}
  for (const l of logs) doneByHabit[l.habit_id] = (doneByHabit[l.habit_id] ?? 0) + 1

  return (Object.keys(AREA_META) as HabitArea[])
    .map((key) => {
      const ids = idsByArea[key] ?? []
      const total = ids.length * 28
      const done = ids.reduce((sum, id) => sum + (doneByHabit[id] ?? 0), 0)
      const meta = AREA_META[key]
      return { key, label: meta.label, icon: meta.icon, color: meta.color, pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0 }
    })
    .filter((a) => (idsByArea[a.key] ?? []).length > 0)
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Abreviaturas dos meses (únicas) que aparecem na janela de `days`. */
function monthsInWindow(days: number): string[] {
  const seen: string[] = []
  for (const d of lastDays(days)) {
    const m = MONTHS_PT[Number(d.slice(5, 7)) - 1]
    if (!seen.includes(m)) seen.push(m)
  }
  return seen
}

const backBtn: CSSProperties = { width: 36, height: 36, borderRadius: 11, background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text1)', textDecoration: 'none', fontSize: 22, fontWeight: 700, flexShrink: 0 }
const panel: CSSProperties = { background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 20, padding: 16 }
