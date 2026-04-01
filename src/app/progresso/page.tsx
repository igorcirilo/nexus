'use client'
// src/app/progresso/page.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import WeeklyRankCard from '@/components/WeeklyRankCard'
import { getProfile, supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

type EvoTab = 'evolucao' | 'dashboard'

type HabitLogRow = {
  date: string
  completed: boolean
}

type CheckinRow = {
  date: string
  phase?: string | null
  mood?: number | null
  energy?: number | null
  sleep_hours?: number | null
  xp_earned?: number | null
}

type ChartRow = {
  day: string
  humor: number
  energia: number
}

type HeatmapCell = {
  date: string
  label: string
  complete: boolean
  partial: boolean
  habits: number
  checkins: number
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 8px',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--bg1)' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--text3)',
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: tone }}>{value}</div>
    </div>
  )
}

export default function ProgressoPage() {
  const [tab, setTab] = useState<EvoTab>('evolucao')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [xpActual, setXpActual] = useState(0)
  const [xpAnterior, setXpAnterior] = useState(0)
  const [streakBest, setStreakBest] = useState(0)
  const [streakCurrent, setStreakCurrent] = useState(0)
  const [habitsDoneWeek, setHabitsDoneWeek] = useState(0)
  const [checkinsWeek, setCheckinsWeek] = useState(0)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/auth'
        return
      }

      const prof = (await getProfile(user.id)) as Profile | null
      setProfile(prof)
      setStreakBest(Number(prof?.streak_best ?? 0))
      setStreakCurrent(Number(prof?.streak_current ?? 0))

      const today = new Date()
      const start28 = format(subDays(today, 27), 'yyyy-MM-dd')
      const start14 = format(subDays(today, 13), 'yyyy-MM-dd')

      const startCurrentWeekDate = new Date(today)
      startCurrentWeekDate.setDate(today.getDate() - today.getDay())
      const startPrevWeekDate = new Date(startCurrentWeekDate)
      startPrevWeekDate.setDate(startCurrentWeekDate.getDate() - 7)

      const startCurrentWeek = format(startCurrentWeekDate, 'yyyy-MM-dd')
      const startPrevWeek = format(startPrevWeekDate, 'yyyy-MM-dd')

      const [
        checkinsRes,
        logsRes,
        weekCurrentRes,
        weekPrevRes,
      ] = await Promise.all([
        supabase
          .from('checkins')
          .select('date, phase, mood, energy, sleep_hours, xp_earned')
          .eq('user_id', user.id)
          .gte('date', start14)
          .order('date', { ascending: true }),
        supabase
          .from('habit_logs')
          .select('date, completed')
          .eq('user_id', user.id)
          .gte('date', start28)
          .order('date', { ascending: true }),
        supabase
          .from('checkins')
          .select('date, xp_earned')
          .eq('user_id', user.id)
          .gte('date', startCurrentWeek),
        supabase
          .from('checkins')
          .select('date, xp_earned')
          .eq('user_id', user.id)
          .gte('date', startPrevWeek)
          .lt('date', startCurrentWeek),
      ])

      const checkins = (checkinsRes.data ?? []) as unknown as CheckinRow[]
      const logs = (logsRes.data ?? []) as unknown as HabitLogRow[]
      const weekCurrent = (weekCurrentRes.data ?? []) as unknown as CheckinRow[]
      const weekPrev = (weekPrevRes.data ?? []) as unknown as CheckinRow[]

      const chartRows: ChartRow[] = []
      for (let i = 6; i >= 0; i -= 1) {
        const dayDate = subDays(today, i)
        const day = format(dayDate, 'yyyy-MM-dd')
        const rows = checkins.filter((c) => c.date === day)
        const moods = rows.filter((r) => typeof r.mood === 'number').map((r) => Number(r.mood))
        const energies = rows.filter((r) => typeof r.energy === 'number').map((r) => Number(r.energy))
        const avgMood = moods.length > 0 ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : 0
        const avgEnergy = energies.length > 0 ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : 0

        chartRows.push({
          day: format(dayDate, 'EEE', { locale: pt }),
          humor: avgMood,
          energia: avgEnergy,
        })
      }
      setChartData(chartRows)

      const heatRows: HeatmapCell[] = []
      for (let i = 27; i >= 0; i -= 1) {
        const dayDate = subDays(today, i)
        const day = format(dayDate, 'yyyy-MM-dd')
        const dayLogs = logs.filter((l) => l.date === day && l.completed)
        const dayCheckins = checkins.filter((c) => c.date === day)
        const habits = dayLogs.length
        const checkinCount = dayCheckins.length
        const complete = habits >= 1 && checkinCount >= 2
        const partial = !complete && (habits > 0 || checkinCount > 0)

        heatRows.push({
          date: day,
          label: format(dayDate, 'd/MM'),
          complete,
          partial,
          habits,
          checkins: checkinCount,
        })
      }
      setHeatmap(heatRows)

      const xpCurrentWeek = weekCurrent.reduce((sum, row) => sum + Number(row.xp_earned ?? 0), 0)
      const xpPrevWeek = weekPrev.reduce((sum, row) => sum + Number(row.xp_earned ?? 0), 0)
      setXpActual(xpCurrentWeek)
      setXpAnterior(xpPrevWeek)

      setHabitsDoneWeek(logs.filter((l) => l.date >= startCurrentWeek && l.completed).length)
      setCheckinsWeek(weekCurrent.length)
      setLoading(false)
    }

    load()
  }, [])

  const diff = useMemo(() => {
    if (xpAnterior <= 0) return xpActual > 0 ? 100 : 0
    return Math.round(((xpActual - xpAnterior) / xpAnterior) * 100)
  }, [xpActual, xpAnterior])

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
            Progresso
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Evolução semanal, consistência e comparação contigo mesmo.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            background: 'var(--bg2)',
            borderRadius: 14,
            padding: 4,
            gap: 4,
            border: '0.5px solid var(--border)',
            marginBottom: 18,
          }}
        >
          <TabButton active={tab === 'evolucao'} label="Evolução" onClick={() => setTab('evolucao')} />
          <TabButton active={tab === 'dashboard'} label="Dashboard" onClick={() => setTab('dashboard')} />
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}>a carregar…</div>
        ) : (
          <>
            {tab === 'evolucao' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <WeeklyRankCard xpActual={xpActual} xpAnterior={xpAnterior} diff={diff} />
                </div>

                <div
                  style={{
                    background: 'var(--bg2)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--gold)',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 8,
                      fontWeight: 700,
                    }}
                  >
                    Humor e energia
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
                    Últimos 7 dias
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                    Média dos check-ins preenchidos por dia.
                  </div>

                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fill: '#9BA0B0', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fill: '#9BA0B0', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#1C2030',
                            border: '0.5px solid rgba(255,255,255,0.07)',
                            borderRadius: 12,
                            color: '#F0EDE8',
                          }}
                        />
                        <Line type="monotone" dataKey="humor" stroke="var(--gold)" strokeWidth={3} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="energia" stroke="var(--teal)" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg2)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--gold)',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 8,
                      fontWeight: 700,
                    }}
                  >
                    Heatmap de consistência
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
                    Últimos 28 dias
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                    Verde = dia completo · Roxo = parcial · Escuro = sem registo
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: 6,
                    }}
                  >
                    {heatmap.map((cell) => (
                      <div
                        key={cell.date}
                        title={`${cell.label} · hábitos ${cell.habits} · check-ins ${cell.checkins}`}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 8,
                          background: cell.complete
                            ? 'var(--teal)'
                            : cell.partial
                              ? 'rgba(127,119,221,.55)'
                              : 'var(--bg3)',
                          border: '0.5px solid rgba(255,255,255,0.05)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'dashboard' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <StatCard label="Nível" value={profile?.level ?? 1} tone="var(--gold)" />
                  <StatCard label="XP total" value={profile?.xp_total ?? 0} tone="var(--teal)" />
                  <StatCard label="Streak actual" value={streakCurrent} tone="var(--accent)" />
                  <StatCard label="Melhor streak" value={streakBest} tone="var(--gold)" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatCard label="Hábitos feitos na semana" value={habitsDoneWeek} tone="var(--teal)" />
                  <StatCard label="Check-ins na semana" value={checkinsWeek} tone="var(--accent)" />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Nav />
    </main>
  )
}
