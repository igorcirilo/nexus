'use client'

// Dashboard semanal — recuperado da antiga aba /progresso e unificado em
// /estatisticas: métricas da semana, gráfico de atividade (hábitos + check-ins),
// energia/sono e resumo. Auto-suficiente: recebe userId + streak e busca o resto.

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase, getRitmo } from '@/lib/supabase'
import {
  completedByDay, checkinsByDay, completionRate, averageCheckin, activityCount,
  type WeekLog, type WeekCheckin,
} from '@/lib/weekly'
import { format, subDays } from 'date-fns'

const FONT = 'Inter, sans-serif'
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  userId: string
  streakCurrent: number
}

type XpDay = { day: string; xp: number; hab: number; ci: number }
type EsDay = { day: string; energia: number | null; sono: number | null }
type Stats = {
  consistency: number; prevConsistency: number
  activityTrend: number; energy: number; sleep: number
  thisDone: number; thisTotal: number; checkinsToday: number
}

export default function WeeklyDashboard({ userId, streakCurrent }: Props) {
  const [ritmo, setRitmo] = useState(0)
  const [xpData, setXpData] = useState<XpDay[]>([])
  const [esData, setEsData] = useState<EsDay[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const since7 = format(subDays(new Date(), 6), 'yyyy-MM-dd')
      const since14 = format(subDays(new Date(), 13), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')

      // Uma única janela de 14d de hábitos e check-ins cobre tanto a semana atual
      // como a anterior — evita as ~4 queries sobrepostas que existiam antes.
      const [ritmoNow, { data: logsRaw }, { data: ciRaw }] = await Promise.all([
        getRitmo(userId),
        supabase.from('habit_logs').select('date,completed').eq('user_id', userId).gte('date', since14),
        supabase.from('checkins').select('date,energy,sleep_hours').eq('user_id', userId).gte('date', since14),
      ])
      if (cancelled) return

      const logs14 = (logsRaw ?? []) as WeekLog[]
      const ci14 = (ciRaw ?? []) as WeekCheckin[]
      // Semana atual (últimos 7d) vs semana anterior (dias 8–14).
      const logs = logs14.filter((l) => l.date >= since7)
      const checkins = ci14.filter((c) => c.date >= since7)
      const prevLogs = logs14.filter((l) => l.date < since7)
      const prevCheckins = ci14.filter((c) => c.date < since7)

      const doneByDay = completedByDay(logs)
      const ciByDay = checkinsByDay(checkins)
      const xpByDay: XpDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i)
        const day = format(d, 'yyyy-MM-dd')
        const hab = doneByDay[day] ?? 0
        const ci = ciByDay[day] ?? 0
        return { day: DAYS_PT[d.getDay()], xp: hab + ci, hab, ci }
      })

      const esD: EsDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i)
        const day = format(d, 'yyyy-MM-dd')
        const ci = checkins.find((c) => c.date === day)
        return { day: DAYS_PT[d.getDay()], energia: ci?.energy ?? null, sono: ci?.sleep_hours ?? null }
      })

      const thisDone = logs.filter((l) => l.completed).length
      const thisTotal = logs.length
      const consistency = completionRate(logs)
      const prevConsistency = completionRate(prevLogs)
      const activityWeek = activityCount(logs, checkins)
      const prevActivity = activityCount(prevLogs, prevCheckins)
      const energy = averageCheckin(checkins, 'energy')
      const sleep = averageCheckin(checkins, 'sleep_hours')
      const checkinsToday = checkins.filter((c) => c.date === today).length

      setRitmo(ritmoNow)
      setXpData(xpByDay)
      setEsData(esD)
      setStats({ consistency, prevConsistency, activityTrend: activityWeek - prevActivity, energy, sleep, thisDone, thisTotal, checkinsToday })
      setTimeout(() => { if (!cancelled) setReady(true) }, 60)
    }
    load().catch((e) => console.error('[estatisticas] dashboard falhou:', e))
    return () => { cancelled = true }
  }, [userId])

  const TT: CSSProperties = {
    background: 'var(--bg2)', border: '0.5px solid rgba(var(--ink-rgb),.1)',
    borderRadius: 10, color: 'var(--text1)', fontSize: 12,
  }

  if (!stats) {
    return <div style={{ color: 'var(--text3)', fontSize: 12, padding: '12px 0' }}>A carregar o dashboard…</div>
  }

  return (
    <div>
      {/* Métricas da semana */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>Esta semana</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: 'var(--gold-ink)', lineHeight: 1 }}>{stats.checkinsToday}/3</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>check-ins hoje</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { l: 'Conclusão · 7d', v: `${stats.consistency}%`, c: 'var(--green-ink)', trend: `${stats.consistency >= stats.prevConsistency ? '↑' : '↓'} vs semana passada`, up: stats.consistency >= stats.prevConsistency },
          { l: 'Ritmo atual', v: `${ritmo}`, c: 'var(--gold-ink)', trend: `${stats.activityTrend >= 0 ? '↑ +' : '↓ '}${Math.abs(stats.activityTrend)} conclusões`, up: stats.activityTrend >= 0 },
          { l: 'Energia média', v: stats.energy > 0 ? `${stats.energy}/10` : '—', c: 'var(--purple-ink)', sub: stats.energy >= 7 ? 'Boa semana ⚡' : stats.energy > 0 ? 'Recupera o sono' : 'Sem dados' },
          { l: 'Sono médio', v: stats.sleep > 0 ? `${stats.sleep}h` : '—', c: 'var(--ink)', sub: stats.sleep >= 7 ? 'Dentro do ideal' : stats.sleep > 0 ? 'Abaixo do ideal' : 'Sem dados' },
        ].map(({ l, v, c, trend, sub, up }) => (
          <div key={l} style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{l}</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: c, marginBottom: 3, lineHeight: 1 }}>{v}</div>
            {trend && <div style={{ fontSize: 11, color: up ? 'var(--green-ink)' : 'var(--red-ink)' }}>{trend}</div>}
            {sub && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Mentor */}
      <div style={{ margin: '12px 0 0', padding: '14px 16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid rgba(0,200,150,0.15)', fontSize: 13, color: 'var(--text1)', lineHeight: 1.6 }}>
        <span style={{ color: 'var(--green-ink)', fontWeight: 500 }}>Mentor: </span>
        {stats.consistency >= 80 ? `Consistência de ${stats.consistency}% — execução real.` : `${stats.consistency}% esta semana. Foca num hábito de cada vez.`}{' '}
        <span style={{ color: 'var(--gold-ink)' }}>
          Próxima conquista:{' '}
          {streakCurrent < 7 ? `streak de 7 dias — faltam ${7 - streakCurrent}` : streakCurrent < 21 ? `streak de 21 dias — faltam ${21 - streakCurrent}` : `streak de 100 dias — faltam ${100 - streakCurrent}`} dias.
        </span>
      </div>

      {/* Atividade diária */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Atividade diária — hábitos + check-ins</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
          {([['#534AB7', 'Hábitos'], ['#E8A838', 'Check-ins']] as [string, string][]).map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
        <div
          style={{ height: 150 }}
          role="img"
          aria-label={`Gráfico de atividade diária dos últimos 7 dias: ${xpData.reduce((a, d) => a + d.hab, 0)} hábitos concluídos e ${xpData.reduce((a, d) => a + d.ci, 0)} check-ins.`}
        >
          {ready && (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={xpData} barGap={2} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="rgba(var(--ink-rgb),.04)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(var(--ink-rgb),0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [v, n === 'hab' ? 'Hábitos' : 'Check-ins']} />
                <Bar dataKey="hab" name="hab" stackId="a" fill="#534AB7" />
                <Bar dataKey="ci" name="ci" stackId="a" fill="#E8A838" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Energia + Sono */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Energia e Sono — 7 dias</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
          {([['#00C896', 'Energia'], ['#9D5CF5', 'Sono (h)']] as [string, string][]).map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
        <div
          style={{ height: 130 }}
          role="img"
          aria-label={`Gráfico de energia e sono dos últimos 7 dias. Energia média ${stats.energy > 0 ? `${stats.energy}/10` : 'sem dados'}, sono médio ${stats.sleep > 0 ? `${stats.sleep}h` : 'sem dados'}.`}
        >
          {ready && (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={esData}>
                <CartesianGrid vertical={false} stroke="rgba(var(--ink-rgb),.04)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(var(--ink-rgb),0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 12]} />
                <Tooltip contentStyle={TT} />
                <Line type="monotone" dataKey="energia" stroke="#00C896" strokeWidth={2} dot={{ fill: '#00C896', r: 3 }} connectNulls />
                <Line type="monotone" dataKey="sono" stroke="#9D5CF5" strokeWidth={2} dot={{ fill: '#9D5CF5', r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Resumo da semana */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 14, padding: '14px 16px', marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Resumo da semana</div>
        {[
          { l: 'Hábitos concluídos', v: `${stats.thisDone} de ${stats.thisTotal}`, c: stats.consistency >= 70 ? 'var(--green-ink)' : 'var(--gold-ink)' },
          { l: 'Check-ins da semana', v: `${xpData.reduce((a, d) => a + d.ci, 0)}`, c: 'var(--purple-ink)' },
          { l: 'Ritmo atual', v: `${ritmo}`, c: 'var(--gold-ink)' },
          { l: 'Streak atual', v: `${streakCurrent} dias 🔥`, c: 'var(--gold-ink)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: 'var(--text1)' }}>{l}</span>
            <span style={{ color: c, fontFamily: FONT, fontWeight: 600, lineHeight: 1 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
