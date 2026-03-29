'use client'
// src/app/calendario/page.tsx
import { useEffect, useState, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, subMonths, addMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import { supabase, getCalendarData } from '@/lib/supabase'

type DayStatus = {
  habits:   number   // 0–3+ hábitos feitos
  checkins: number   // 0–3 check-ins feitos
  complete: boolean  // ≥80% dos check-ins + algum hábito
}

const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function CalendarioPage() {
  const [userId,   setUserId]   = useState<string | null>(null)
  const [current,  setCurrent]  = useState(new Date())
  const [dayMap,   setDayMap]   = useState<Record<string, DayStatus>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  const loadMonth = useCallback(async (uid: string, date: Date) => {
    setLoading(true)
    const { logs, checkins } = await getCalendarData(uid, date.getFullYear(), date.getMonth() + 1)

    const map: Record<string, DayStatus> = {}

    logs.forEach((l: { date: string; completed: boolean }) => {
      if (!map[l.date]) map[l.date] = { habits: 0, checkins: 0, complete: false }
      if (l.completed) map[l.date].habits++
    })
    checkins.forEach((c: { date: string }) => {
      if (!map[c.date]) map[c.date] = { habits: 0, checkins: 0, complete: false }
      map[c.date].checkins++
    })
    Object.keys(map).forEach(d => {
      const s = map[d]
      s.complete = s.checkins >= 2 && s.habits >= 1
    })

    setDayMap(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      loadMonth(user.id, current)
    })
  }, [])

  function changeMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(current, 1) : subMonths(current, 1)
    setCurrent(next)
    if (userId) loadMonth(userId, next)
  }

  const days       = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad   = getDay(startOfMonth(current)) // 0=Dom
  const totalDays  = days.length
  const doneDays   = Object.values(dayMap).filter(d => d.complete).length
  const todayStr   = format(new Date(), 'yyyy-MM-dd')

  function dayColor(dateStr: string): string {
    if (!dayMap[dateStr]) return 'transparent'
    const s = dayMap[dateStr]
    if (s.complete)      return 'var(--teal)'
    if (s.checkins >= 1) return 'rgba(127,119,221,.5)'
    if (s.habits >= 1)   return 'rgba(232,168,56,.4)'
    return 'transparent'
  }

  const sel = selected ? dayMap[selected] : null

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22 }}>Calendário</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {doneDays} dias completos em {format(current, 'MMMM', { locale: pt })}
        </p>
      </div>

      {/* Resumo do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '14px 20px 0' }}>
        {[
          { label: 'Completos', value: doneDays,                         color: 'var(--teal)' },
          { label: 'Parciais',  value: Object.values(dayMap).filter(d => !d.complete && (d.checkins > 0 || d.habits > 0)).length, color: 'var(--accent)' },
          { label: '% do mês',  value: totalDays > 0 ? Math.round(doneDays / totalDays * 100) + '%' : '0%', color: 'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg2)', border: '0.5px solid var(--border)',
            borderRadius: 14, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Navegação mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 10px' }}>
        <button onClick={() => changeMonth(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 18 }}>
          ‹
        </button>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 16 }}>
          {format(current, 'MMMM yyyy', { locale: pt })}
        </span>
        <button onClick={() => changeMonth(1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 18 }}>
          ›
        </button>
      </div>

      {/* Grid calendário */}
      <div style={{ padding: '0 20px' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Dias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {/* Padding inicial */}
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}

          {days.map(day => {
            const dateStr  = format(day, 'yyyy-MM-dd')
            const status   = dayMap[dateStr]
            const isT      = isToday(day)
            const isSel    = selected === dateStr
            const bg       = dayColor(dateStr)
            const hasData  = !!status
            const future   = day > new Date()

            return (
              <button key={dateStr}
                onClick={() => setSelected(isSel ? null : dateStr)}
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  border: isT
                    ? '2px solid var(--gold)'
                    : isSel
                    ? '1.5px solid var(--accent)'
                    : '0.5px solid var(--border)',
                  background: isSel ? 'rgba(127,119,221,.12)' : bg,
                  cursor: hasData ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  opacity: future ? 0.3 : 1,
                  transition: 'all .15s',
                }}>
                <span style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: isT ? 700 : 400,
                  fontSize: 13,
                  color: status?.complete ? 'var(--bg0)' : isT ? 'var(--gold)' : 'var(--text2)',
                }}>
                  {format(day, 'd')}
                </span>
                {/* Dots indicadores */}
                {hasData && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {status.checkins > 0 && (
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: status.complete ? 'var(--bg0)' : 'var(--accent)' }} />
                    )}
                    {status.habits > 0 && (
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: status.complete ? 'var(--bg0)' : 'var(--gold)' }} />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, padding: '14px 20px 0', flexWrap: 'wrap' }}>
        {[
          { color: 'var(--teal)',               label: 'Dia completo' },
          { color: 'rgba(127,119,221,.5)',       label: 'Check-in feito' },
          { color: 'rgba(232,168,56,.4)',        label: 'Hábito feito' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Detalhe do dia selecionado */}
      {selected && sel && (
        <div style={{
          margin: '14px 20px 0',
          padding: 16,
          borderRadius: 16,
          background: 'var(--bg2)',
          border: '0.5px solid rgba(127,119,221,.22)',
        }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
            {format(new Date(selected + 'T12:00:00'), "d 'de' MMMM", { locale: pt })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Hábitos concluídos</span>
              <span style={{ color: 'var(--gold)', fontWeight: 500 }}>{sel.habits}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Check-ins feitos</span>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{sel.checkins} / 3</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Dia completo</span>
              <span style={{ color: sel.complete ? 'var(--teal)' : 'var(--text3)', fontWeight: 500 }}>
                {sel.complete ? '✓ Sim' : '✗ Não'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
