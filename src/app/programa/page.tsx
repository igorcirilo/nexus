'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getProgramWithWeeks, getProgramTasks } from '@/lib/program'
import type { ProgramTask } from '@/types'
import type { WeekWithDays, DayWithCounts } from '@/lib/program'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const AREA_LABELS: Record<string, string> = {
  corpo: 'Corpo',
  produtividade: 'Produtividade',
  idiomas: 'Idiomas',
  carreira: 'Carreira',
  financas: 'Finanças',
  emocoes: 'Emoções',
  relacionamentos: 'Relac.',
}

function currentWeekNumber(startedAt: string): number {
  const start = new Date(startedAt)
  const today = new Date()
  const dayDiff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(dayDiff / 7) + 1, 1), 9)
}

type DayStatus = 'completed' | 'partial' | 'today' | 'future'

function getDayStatus(day: DayWithCounts, todayStr: string): DayStatus {
  if (day.date === todayStr) return 'today'
  if (day.date > todayStr) return 'future'
  if (day.task_counts.total > 0 && day.task_counts.completed === day.task_counts.total) return 'completed'
  if (day.task_counts.completed > 0) return 'partial'
  return 'future'
}

export default function ProgramaPage() {
  const router = useRouter()
  const [weeks, setWeeks] = useState<WeekWithDays[]>([])
  const [loading, setLoading] = useState(true)
  const [noProgram, setNoProgram] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [drawerTasks, setDrawerTasks] = useState<ProgramTask[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/auth'); return }
      const result = await getProgramWithWeeks(data.user.id)
      if (!result) { setNoProgram(true); setLoading(false); return }
      setWeeks(result.weeks)
      setSelectedWeek(currentWeekNumber(result.program.started_at))
      setLoading(false)
    })
  }, [router])

  const handleDayClick = async (dayId: string) => {
    if (selectedDayId === dayId) { setSelectedDayId(null); return }
    setSelectedDayId(dayId)
    setDrawerLoading(true)
    setDrawerError(false)
    try {
      const tasks = await getProgramTasks(dayId)
      setDrawerTasks(tasks)
    } catch {
      setDrawerError(true)
    } finally {
      setDrawerLoading(false)
    }
  }

  const currentWeek = weeks.find(w => w.week_number === selectedWeek)
  const selectedDay = currentWeek?.days.find(d => d.id === selectedDayId)
  const allDays = weeks.flatMap(w => w.days)
  const completedDays = allDays.filter(d =>
    d.task_counts.total > 0 && d.task_counts.completed === d.task_counts.total
  ).length
  const progressPct = allDays.length > 0 ? Math.round((completedDays / allDays.length) * 100) : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--gold)', borderTopColor: 'transparent', animation: 'spin .8s linear infinite' }} />
      </div>
    )
  }

  if (noProgram) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 20px', background: 'var(--bg0)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text1)' }}>Nenhum programa ativo</p>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Faça seu diagnóstico para gerar seu plano.</p>
        <button className="btn-primary" onClick={() => router.push('/onboarding-v2')}>
          Fazer diagnóstico →
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => router.back()}>
          ← Voltar
        </button>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text1)' }}>Seu Programa</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {allDays.length > 0 ? `Dia ${completedDays + 1} de ${allDays.length}` : ''} · {currentWeek?.theme ?? ''}
          </div>
        </div>
      </div>

      {/* Barra de progresso global */}
      <div style={{ background: 'var(--bg3)', height: 4, borderRadius: 100, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ background: 'var(--teal)', width: `${progressPct}%`, height: '100%', borderRadius: 100, transition: 'width .6s ease' }} />
      </div>

      {/* Navegação de semana */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={() => { setSelectedWeek(w => Math.max(1, w - 1)); setSelectedDayId(null) }}
          disabled={selectedWeek === 1}
          style={{
            background: 'rgba(127,119,221,.1)', border: '0.5px solid var(--border)',
            borderRadius: 8, color: selectedWeek === 1 ? 'var(--text3)' : 'var(--accent)',
            padding: '6px 10px', fontSize: 13,
            cursor: selectedWeek === 1 ? 'not-allowed' : 'pointer',
            opacity: selectedWeek === 1 ? 0.4 : 1,
          }}
        >◀</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>
            Semana {selectedWeek} — {currentWeek?.theme ?? ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {currentWeek && currentWeek.days.length > 0
              ? `Dias ${currentWeek.days[0].day_number}–${currentWeek.days[currentWeek.days.length - 1].day_number}`
              : ''}
          </div>
        </div>

        <button
          onClick={() => { setSelectedWeek(w => Math.min(9, w + 1)); setSelectedDayId(null) }}
          disabled={selectedWeek === 9}
          style={{
            background: 'rgba(127,119,221,.1)', border: '0.5px solid var(--border)',
            borderRadius: 8, color: selectedWeek === 9 ? 'var(--text3)' : 'var(--accent)',
            padding: '6px 10px', fontSize: 13,
            cursor: selectedWeek === 9 ? 'not-allowed' : 'pointer',
            opacity: selectedWeek === 9 ? 0.4 : 1,
          }}
        >▶</button>
      </div>

      {/* Grid de 7 dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
        {(currentWeek?.days ?? []).map((day, i) => {
          const status = getDayStatus(day, todayStr)
          const isSelected = selectedDayId === day.id
          const barPct = day.task_counts.total > 0
            ? Math.round((day.task_counts.completed / day.task_counts.total) * 100)
            : 0
          const barColor = status === 'completed' ? 'var(--teal)'
            : status === 'partial' ? 'var(--gold)'
            : status === 'today' ? 'var(--accent)'
            : 'var(--bg3)'

          return (
            <button
              key={day.id}
              onClick={() => handleDayClick(day.id)}
              style={{
                background: status === 'today' ? 'rgba(127,119,221,.12)' : 'var(--bg2)',
                border: isSelected
                  ? '0.5px solid var(--accent)'
                  : status === 'today'
                    ? '0.5px solid var(--accent)'
                    : '0.5px solid var(--border)',
                borderRadius: 10, padding: '8px 4px', textAlign: 'center',
                cursor: 'pointer', opacity: status === 'future' ? 0.4 : 1,
                transition: 'all .2s ease',
              }}
            >
              <div style={{ fontSize: 9, color: status === 'today' ? 'var(--accent)' : 'var(--text3)', marginBottom: 3, fontWeight: status === 'today' ? 700 : 400 }}>
                {status === 'today' ? 'hoje' : DAY_LABELS[i]}
              </div>
              <div style={{ fontSize: 13, color: status === 'today' ? 'var(--accent)' : 'var(--text1)', fontWeight: 700, marginBottom: 4 }}>
                {day.day_number}
              </div>
              <div style={{ width: '100%', height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 8, color: status === 'completed' ? 'var(--teal)' : status === 'partial' ? 'var(--gold)' : status === 'today' ? 'var(--accent)' : 'var(--text3)' }}>
                {status === 'future' ? '–' : `${day.task_counts.completed}/${day.task_counts.total}`}
              </div>
            </button>
          )
        })}
      </div>

      {/* Dots de semana */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 20 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            onClick={() => { setSelectedWeek(i + 1); setSelectedDayId(null) }}
            style={{
              width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
              cursor: 'pointer', background: i + 1 === selectedWeek ? 'var(--accent)' : 'var(--bg3)',
              opacity: i + 1 === selectedWeek ? 1 : 0.5, transition: 'all .2s ease',
            }}
          />
        ))}
      </div>

      {/* Drawer inline */}
      {selectedDayId && selectedDay && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>
                {DAY_LABELS[(currentWeek?.days.findIndex(d => d.id === selectedDayId) ?? 0)]},{' '}
                {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} · Dia {selectedDay.day_number}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Semana {selectedWeek} — {currentWeek?.theme}
              </div>
            </div>
            {selectedDay.task_counts.total > 0 && (
              <span style={{
                fontSize: 11, borderRadius: 6, padding: '3px 8px',
                color: selectedDay.task_counts.completed === selectedDay.task_counts.total ? 'var(--teal)' : 'var(--gold)',
                background: selectedDay.task_counts.completed === selectedDay.task_counts.total ? 'rgba(30,203,180,.1)' : 'rgba(232,168,56,.1)',
              }}>
                {selectedDay.task_counts.completed}/{selectedDay.task_counts.total}
              </span>
            )}
          </div>

          {drawerLoading ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>
              Carregando...
            </div>
          ) : drawerError ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#E24B4A', fontSize: 13 }}>
              Erro ao carregar tarefas
            </div>
          ) : drawerTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>
              Nenhuma tarefa neste dia
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drawerTasks.map(task => (
                <div
                  key={task.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10 }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: task.status === 'completed' ? 'var(--teal)' : 'transparent',
                    border: task.status === 'completed' ? 'none' : '1.5px solid var(--text3)',
                  }}>
                    {task.status === 'completed' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0D0F14" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13,
                      color: task.status === 'completed' ? 'var(--text3)' : 'var(--text1)',
                      textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                    }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {AREA_LABELS[task.area] ?? task.area} · +{task.xp_reward} XP
                    </div>
                  </div>
                  {task.status === 'skipped' && (
                    <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 4, padding: '2px 6px' }}>
                      pulado
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
