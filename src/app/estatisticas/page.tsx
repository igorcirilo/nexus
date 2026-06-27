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
import type { Profile } from '@/types'

const FONT = 'Inter, sans-serif'
const HEAT = ['rgba(var(--ink-rgb),0.05)', 'rgba(232,168,56,0.28)', 'rgba(232,168,56,0.5)', 'rgba(232,168,56,0.72)', '#E8A838']

export default function EstatisticasPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = '/auth'
        return
      }
      const [prof, s] = await Promise.all([getProfile(user.id), getActivityStats(user.id, 63)])
      setProfile(prof as Profile)
      setStats(s)
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
          <Link href="/progresso" aria-label="Voltar" style={backBtn}>‹</Link>
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
              <RegCard emoji="📊" value={`${success}%`} label="TAXA DE SUCESSO" color="#9C94EC" />
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
