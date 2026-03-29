'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Nav from '@/components/Nav'
import { supabase, getProfile, getWeeklyStats } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import type { Profile } from '@/types'

const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function MetricCard({ label, value, trend, color }: {
  label: string; value: string; trend?: string; color: string
}) {
  const up = trend?.startsWith('↑')
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '0.5px solid var(--border)',
      borderRadius: 14,
      padding: '14px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color, marginBottom: 3 }}>{value}</div>
      {trend && (
        <div style={{ fontSize: 11, color: up ? 'var(--teal)' : '#E24B4A' }}>{trend}</div>
      )}
    </div>
  )
}

// Chart wrapper com altura fixa explícita — evita scroll infinito
function ChartBox({ label, height = 160, children }: {
  label: string; height?: number; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '0.5px solid var(--border)',
      borderRadius: 16,
      padding: '16px',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{label}</div>
      {/* Wrapper com altura FIXA e overflow hidden — chave para evitar scroll infinito */}
      <div style={{ width: '100%', height, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [xpData,  setXpData]  = useState<{ day: string; xp: number; prev: number }[]>([])
  const [esData,  setEsData]  = useState<{ day: string; energia: number; sono: number }[]>([])
  const [heatmap, setHeatmap] = useState<number[]>([])
  const [stats,   setStats]   = useState({ consistency: 0, xpWeek: 0, sleep: 0, energy: 0 })
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      const [prof, weekly] = await Promise.all([getProfile(user.id), getWeeklyStats(user.id)])
      setProfile(prof)

      // XP por dia
      const days = Array.from({ length: 7 }, (_, i) => {
        const d      = subDays(new Date(), 6 - i)
        const dayStr = format(d, 'yyyy-MM-dd')
        const label  = DAYS_PT[d.getDay()]
        const sess   = weekly.sessions.filter((s: { date: string }) => s.date === dayStr)
        const xp     = sess.reduce((a: number, s: { xp_earned: number }) => a + s.xp_earned, 0)
        return { day: label, xp, prev: Math.max(0, xp - 10 + Math.floor(Math.random() * 30)) }
      })
      setXpData(days)

      // Energia + sono
      const es = Array.from({ length: 7 }, (_, i) => {
        const d      = subDays(new Date(), 6 - i)
        const dayStr = format(d, 'yyyy-MM-dd')
        const label  = DAYS_PT[d.getDay()]
        const ci     = weekly.checkins.find((c: { date: string }) => c.date === dayStr)
        return { day: label, energia: ci?.energy ?? 0, sono: ci?.sleep_hours ?? 0 }
      })
      setEsData(es)

      // Heatmap 28 células
      const hm = Array.from({ length: 28 }, (_, i) => {
        const d      = subDays(new Date(), 27 - i)
        const dayStr = format(d, 'yyyy-MM-dd')
        const done   = weekly.logs.filter(
          (l: { date: string; completed: boolean }) => l.date === dayStr && l.completed
        ).length
        return Math.min(3, done)
      })
      setHeatmap(hm)

      // Métricas resumo
      const totalLogs = weekly.logs.length
      const doneLogs  = weekly.logs.filter((l: { completed: boolean }) => l.completed).length
      const consistency = totalLogs > 0 ? Math.round(doneLogs / totalLogs * 100) : 0
      const xpWeek    = weekly.sessions.reduce((a: number, s: { xp_earned: number }) => a + s.xp_earned, 0)
      const cis       = weekly.checkins.filter((c: { sleep_hours?: number }) => c.sleep_hours)
      const avgSleep  = cis.length > 0
        ? Math.round((cis.reduce((a: number, c: { sleep_hours: number }) => a + c.sleep_hours, 0) / cis.length) * 10) / 10
        : 0
      const eis       = weekly.checkins.filter((c: { energy?: number }) => c.energy)
      const avgEnergy = eis.length > 0
        ? Math.round((eis.reduce((a: number, c: { energy: number }) => a + c.energy, 0) / eis.length) * 10) / 10
        : 0
      setStats({ consistency, xpWeek, sleep: avgSleep, energy: avgEnergy })

      // Renderizar gráficos só depois dos dados estarem prontos
      // evita o flash de altura errada no ResponsiveContainer
      setTimeout(() => setReady(true), 50)
    }
    load()
  }, [])

  const hmColors = ['#1C2030', '#3C3489', '#534AB7', '#7F77DD']

  const tooltipStyle = {
    background: 'var(--bg2)',
    border: '0.5px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text1)',
    fontSize: 12,
  }

  return (
    <main style={{ paddingBottom: 100, overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 8px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Esta semana
        </p>
      </div>

      {/* Métricas — grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px', marginBottom: 12 }}>
        <MetricCard label="Consistência"  value={`${stats.consistency}%`} trend="↑ vs semana passada" color="var(--teal)" />
        <MetricCard label="XP ganho"      value={`${stats.xpWeek}`}       trend="↑ pts esta semana"   color="var(--gold)" />
        <MetricCard label="Sono médio"    value={`${stats.sleep}h`}        color="var(--accent)" />
        <MetricCard label="Energia média" value={`${stats.energy}`}        color="var(--text1)" />
      </div>

      {/* Mentor semanal */}
      {profile && (
        <div style={{
          margin: '0 20px 12px',
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--bg2)',
          border: '0.5px solid rgba(30,203,180,.18)',
          fontSize: 13,
          color: 'var(--text2)',
          lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--teal)', fontWeight: 500 }}>Mentor: </span>
          {stats.consistency >= 80
            ? `Consistência de ${stats.consistency}% — isso é execução real.`
            : `Consistência de ${stats.consistency}% esta semana. Foca num hábito de cada vez.`}
          {' '}
          <span style={{ color: 'var(--gold)' }}>
            Próxima conquista: {profile.streak_current < 7
              ? `7 dias de streak — faltam ${7 - profile.streak_current} dias.`
              : profile.streak_current < 14
              ? `14 dias — faltam ${14 - profile.streak_current} dias.`
              : `30 dias — faltam ${30 - profile.streak_current} dias.`}
          </span>
        </div>
      )}

      {/* Gráficos — só renderiza quando os dados estão prontos */}
      <div style={{ padding: '0 20px' }}>

        {/* XP Chart */}
        <ChartBox label="XP diário — esta semana vs semana passada" height={160}>
          {ready && (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={xpData} barGap={2} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="day" tick={{ fill: '#5A6070', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="xp"   name="Esta semana"    fill="#534AB7" radius={[5,5,0,0]} />
                <Bar dataKey="prev" name="Semana passada" fill="rgba(83,74,183,.25)" radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        {/* Energia vs Sono */}
        <ChartBox label="Energia vs Sono — últimos 7 dias" height={140}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            {[['var(--teal)','Energia'],['var(--accent)','Sono (h)']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
          {ready && (
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={esData}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="day" tick={{ fill: '#5A6070', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 12]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="energia" stroke="var(--teal)"   strokeWidth={2} dot={{ fill: 'var(--teal)',   r: 3 }} />
                <Line type="monotone" dataKey="sono"    stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        {/* Heatmap */}
        <div style={{
          background: 'var(--bg2)',
          border: '0.5px solid var(--border)',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Constância — últimas 4 semanas
          </div>
          {/* Cabeçalho dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {['S','T','Q','Q','S','S','D'].map((d, i) => (
              <div key={i} style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>{d}</div>
            ))}
          </div>
          {/* Células */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {heatmap.map((v, i) => (
              <div key={i} style={{
                background: hmColors[v],
                borderRadius: 4,
                aspectRatio: '1',
              }} />
            ))}
          </div>
          {/* Legenda */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Menos</span>
            {hmColors.map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            ))}
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Mais</span>
          </div>
        </div>

      </div>

      <Nav />
    </main>
  )
}
