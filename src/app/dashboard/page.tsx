'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Nav from '@/components/Nav'
import { supabase, getProfile } from '@/lib/supabase'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile } from '@/types'

const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// Busca dados reais de todas as fontes de XP
async function fetchAllStats(userId: string) {
  const today     = new Date()
  const since7    = format(subDays(today, 6),  'yyyy-MM-dd')
  const since14   = format(subDays(today, 13), 'yyyy-MM-dd')
  const since28   = format(subDays(today, 27), 'yyyy-MM-dd')
  const todayStr  = format(today, 'yyyy-MM-dd')

  const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const lastWeekStart = format(startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const lastWeekEnd   = format(endOfWeek(subDays(today, 7),   { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [
    { data: logs7 },
    { data: logs14 },
    { data: logs28 },
    { data: checkins7 },
    { data: checkins14 },
    { data: habits },
  ] = await Promise.all([
    supabase.from('habit_logs').select('date, completed, habit_id').eq('user_id', userId).gte('date', since7),
    supabase.from('habit_logs').select('date, completed').eq('user_id', userId).gte('date', since14).lt('date', since7),
    supabase.from('habit_logs').select('date, completed').eq('user_id', userId).gte('date', since28),
    supabase.from('checkins').select('date, phase, energy, sleep_hours, mood, xp_earned').eq('user_id', userId).gte('date', since7),
    supabase.from('checkins').select('date, phase, xp_earned').eq('user_id', userId).gte('date', since14).lt('date', since7),
    supabase.from('habits').select('id, xp_reward').eq('user_id', userId).eq('active', true),
  ])

  // Mapa xp_reward por habit_id
  const xpMap: Record<string, number> = {}
  ;(habits ?? []).forEach((h: { id: string; xp_reward: number }) => { xpMap[h.id] = h.xp_reward })

  // XP por dia — últimos 7 dias (hábitos + check-ins)
  const xpByDay = Array.from({ length: 7 }, (_, i) => {
    const d   = subDays(today, 6 - i)
    const day = format(d, 'yyyy-MM-dd')
    const habitXP   = (logs7 ?? []).filter((l: { date: string; completed: boolean }) => l.date === day && l.completed)
      .reduce((a: number, l: { habit_id: string }) => a + (xpMap[l.habit_id] ?? 10), 0)
    const checkinXP = (checkins7 ?? []).filter((c: { date: string }) => c.date === day)
      .reduce((a: number, c: { xp_earned: number }) => a + (c.xp_earned ?? 0), 0)
    return { day: DAYS_PT[d.getDay()], xp: habitXP + checkinXP, hab: habitXP, ci: checkinXP }
  })

  // XP semana passada (para comparativo)
  const prevWeekXP = (logs14 ?? []).filter((l: { completed: boolean }) => l.completed)
    .reduce((a: number, l: { habit_id?: string }) => a + (xpMap[l.habit_id ?? ''] ?? 10), 0) +
    (checkins14 ?? []).reduce((a: number, c: { xp_earned: number }) => a + (c.xp_earned ?? 0), 0)

  // Consistência esta semana vs semana passada
  const thisLogs = (logs7 ?? [])
  const prevLogs = (logs14 ?? [])
  const thisDone  = thisLogs.filter((l: { completed: boolean }) => l.completed).length
  const thisTotal = thisLogs.length
  const prevDone  = prevLogs.filter((l: { completed: boolean }) => l.completed).length
  const prevTotal = prevLogs.length
  const consistency     = thisTotal > 0 ? Math.round(thisDone / thisTotal * 100) : 0
  const prevConsistency = prevTotal > 0 ? Math.round(prevDone / prevTotal * 100) : 0

  // XP total desta semana
  const xpWeek = xpByDay.reduce((a, d) => a + d.xp, 0)
  const xpTrend = xpWeek - prevWeekXP

  // Energia + sono últimos 7 dias
  const esData = Array.from({ length: 7 }, (_, i) => {
    const d   = subDays(today, 6 - i)
    const day = format(d, 'yyyy-MM-dd')
    const dayCheckins = (checkins7 ?? []).filter((c: { date: string }) => c.date === day)
    const energies = dayCheckins.filter((c: { energy?: number }) => c.energy).map((c: { energy: number }) => c.energy)
    const sleeps   = dayCheckins.filter((c: { sleep_hours?: number }) => c.sleep_hours).map((c: { sleep_hours: number }) => c.sleep_hours)
    return {
      day: DAYS_PT[d.getDay()],
      energia: energies.length > 0 ? Math.round(energies.reduce((a: number, v: number) => a + v, 0) / energies.length * 10) / 10 : null,
      sono:    sleeps.length   > 0 ? Math.round(sleeps.reduce((a: number, v: number) => a + v, 0) / sleeps.length * 10) / 10 : null,
    }
  })

  // Médias
  const allEnergies = (checkins7 ?? []).filter((c: { energy?: number }) => c.energy).map((c: { energy: number }) => c.energy)
  const allSleeps   = (checkins7 ?? []).filter((c: { sleep_hours?: number }) => c.sleep_hours).map((c: { sleep_hours: number }) => c.sleep_hours)
  const avgEnergy = allEnergies.length > 0 ? Math.round(allEnergies.reduce((a: number, v: number) => a + v, 0) / allEnergies.length * 10) / 10 : 0
  const avgSleep  = allSleeps.length   > 0 ? Math.round(allSleeps.reduce((a: number, v: number) => a + v, 0) / allSleeps.length * 10) / 10 : 0

  // Heatmap 28 dias
  const heatmap = Array.from({ length: 28 }, (_, i) => {
    const d   = subDays(today, 27 - i)
    const day = format(d, 'yyyy-MM-dd')
    const done = (logs28 ?? []).filter((l: { date: string; completed: boolean }) => l.date === day && l.completed).length
    return Math.min(3, done)
  })

  // Check-ins hoje
  const checkinsToday = (checkins7 ?? []).filter((c: { date: string }) => c.date === todayStr).length

  return {
    xpByDay, prevWeekXP, xpWeek, xpTrend,
    consistency, prevConsistency,
    esData, avgEnergy, avgSleep,
    heatmap, checkinsToday,
    thisDone, thisTotal,
  }
}

function MetricCard({ label, value, trend, color, sub }: {
  label: string; value: string; trend?: string; color: string; sub?: string
}) {
  const up = trend?.startsWith('↑')
  const dn = trend?.startsWith('↓')
  return (
    <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub  && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{sub}</div>}
      {trend && <div style={{ fontSize: 11, color: up ? 'var(--teal)' : dn ? '#E24B4A' : 'var(--text3)' }}>{trend}</div>}
    </div>
  )
}

function ChartBox({ label, height = 160, children }: { label: string; height?: number; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{label}</div>
      <div style={{ width: '100%', height, overflow: 'hidden', position: 'relative' }}>{children}</div>
    </div>
  )
}

const TT: React.CSSProperties = { background: '#1C2030', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#F0EDE8', fontSize: 12 }

export default function DashboardPage() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [data,     setData]     = useState<Awaited<ReturnType<typeof fetchAllStats>> | null>(null)
  const [ready,    setReady]    = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      const [prof, stats] = await Promise.all([getProfile(user.id), fetchAllStats(user.id)])
      setProfile(prof)
      setData(stats)
      setLoading(false)
      setTimeout(() => setReady(true), 60)
    })
  }, [])

  if (loading || !data || !profile) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text3)' }}>a carregar…</div>
    </div>
  )

  const { xpByDay, xpWeek, xpTrend, consistency, prevConsistency, esData, avgEnergy, avgSleep, heatmap, checkinsToday, thisDone, thisTotal } = data
  const hmColors = ['#1C2030', '#3C3489', '#534AB7', '#7F77DD']

  // Mentor adaptativo
  const mentorMsg = consistency >= 80
    ? `Consistência de ${consistency}% — execução real. Mantém o ritmo.`
    : consistency >= 50
    ? `${consistency}% esta semana. ${thisDone} de ${thisTotal} hábitos feitos. Um de cada vez.`
    : `Semana desafiante — ${consistency}% de conclusão. Retoma com 1 hábito agora.`

  const nextGoal = profile.streak_current < 7
    ? `streak de 7 dias — faltam ${7 - profile.streak_current}`
    : profile.streak_current < 14
    ? `streak de 14 dias — faltam ${14 - profile.streak_current}`
    : `streak de 30 dias — faltam ${30 - profile.streak_current}`

  return (
    <main style={{ paddingBottom: 100, overflowX: 'hidden', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '28px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>{checkinsToday}/3</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>check-ins hoje</div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px', marginBottom: 12 }}>
        <MetricCard
          label="Consistência"
          value={`${consistency}%`}
          trend={consistency >= prevConsistency ? `↑ ${consistency - prevConsistency}% vs semana passada` : `↓ ${prevConsistency - consistency}% vs semana passada`}
          color="var(--teal)"
        />
        <MetricCard
          label="XP esta semana"
          value={xpWeek.toString()}
          trend={xpTrend >= 0 ? `↑ +${xpTrend} vs semana passada` : `↓ ${xpTrend} vs semana passada`}
          color="var(--gold)"
        />
        <MetricCard
          label="Energia média"
          value={avgEnergy > 0 ? `${avgEnergy}/10` : '—'}
          color="var(--accent)"
          sub={avgEnergy >= 7 ? 'Boa semana ⚡' : avgEnergy > 0 ? 'Recupera o sono' : 'Sem dados ainda'}
        />
        <MetricCard
          label="Sono médio"
          value={avgSleep > 0 ? `${avgSleep}h` : '—'}
          color="var(--text1)"
          sub={avgSleep >= 7 ? 'Dentro do ideal' : avgSleep > 0 ? 'Abaixo do ideal' : 'Sem dados ainda'}
        />
      </div>

      {/* Mentor */}
      <div style={{ margin: '0 20px 12px', padding: '14px 16px', borderRadius: 14, background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.18)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        <span style={{ color: 'var(--teal)', fontWeight: 500 }}>Mentor: </span>
        {mentorMsg}{' '}
        <span style={{ color: 'var(--gold)' }}>Próxima conquista: {nextGoal} dias.</span>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* XP Chart — dados reais por dia */}
        <ChartBox label="XP ganho por dia — últimos 7 dias" height={170}>
          {ready ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={xpByDay} barGap={3} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="day" tick={{ fill: '#5A6070', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={TT}
                  formatter={(v: number, name: string) => [v, name === 'hab' ? 'Hábitos XP' : 'Check-in XP']}
                />
                <Bar dataKey="hab" name="hab" stackId="a" fill="#534AB7" radius={[0,0,0,0]} />
                <Bar dataKey="ci"  name="ci"  stackId="a" fill="#E8A838" radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>a carregar…</div>}
          {/* Legenda */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[['#534AB7','Hábitos'],['#E8A838','Check-ins']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </ChartBox>

        {/* Energia + Sono */}
        <ChartBox label="Energia e Sono — últimos 7 dias" height={150}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            {[['var(--teal)','Energia (1–10)'],['var(--accent)','Sono (horas)']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
          {ready ? (
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={esData}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="day" tick={{ fill: '#5A6070', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 12]} />
                <Tooltip contentStyle={TT} />
                <Line type="monotone" dataKey="energia" stroke="var(--teal)"   strokeWidth={2} dot={{ fill: 'var(--teal)',   r: 3 }} connectNulls />
                <Line type="monotone" dataKey="sono"    stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 110 }} />}
        </ChartBox>

        {/* Heatmap */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Constância — últimas 4 semanas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {['S','T','Q','Q','S','S','D'].map((d, i) => (
              <div key={i} style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {heatmap.map((v, i) => (
              <div key={i} style={{ background: hmColors[v], borderRadius: 4, aspectRatio: '1' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Menos</span>
            {hmColors.map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />)}
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Mais</span>
          </div>
        </div>

        {/* Resumo textual */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Resumo da semana</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Hábitos concluídos', value: `${thisDone} de ${thisTotal}`, color: consistency >= 70 ? 'var(--teal)' : 'var(--gold)' },
              { label: 'XP de hábitos',      value: `${xpByDay.reduce((a, d) => a + d.hab, 0)} XP`, color: 'var(--accent)' },
              { label: 'XP de check-ins',    value: `${xpByDay.reduce((a, d) => a + d.ci, 0)} XP`,  color: 'var(--gold)' },
              { label: 'Streak actual',      value: `${profile.streak_current} dias 🔥`, color: 'var(--gold)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{label}</span>
                <span style={{ color, fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <Nav />
    </main>
  )
}
