'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getProgramWithWeeks, getProgramTasks } from '@/lib/program'
import type { ProgramTask } from '@/types'
import type { WeekWithDays, DayWithCounts } from '@/lib/program'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
)

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

const AREA_LABELS: Record<string, string> = {
  corpo: 'Corpo',
  produtividade: 'Produtividade',
  idiomas: 'Idiomas',
  carreira: 'Carreira',
  financas: 'Finanças',
  emocoes: 'Emoções',
  relacionamentos: 'Relacionamentos',
}

function currentWeekNumber(startedAt: string): number {
  const start = new Date(startedAt)
  const today = new Date()
  const dayDiff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(dayDiff / 7) + 1, 1), 9)
}

type DayStatus = 'completed' | 'partial' | 'today' | 'future' | 'empty'

function getDayStatus(day: DayWithCounts, todayStr: string): DayStatus {
  if (day.date === todayStr) return 'today'
  if (day.task_counts.total === 0) return day.date > todayStr ? 'future' : 'empty'
  if (day.date > todayStr) return 'future'
  if (day.task_counts.completed === day.task_counts.total) return 'completed'
  if (day.task_counts.completed > 0) return 'partial'
  return 'empty'
}

function statusColors(status: DayStatus) {
  if (status === 'completed') return { border: 'rgba(30,203,180,.35)', bg: 'rgba(30,203,180,.08)', bar: 'var(--teal)' }
  if (status === 'partial') return { border: 'rgba(232,168,56,.3)', bg: 'rgba(232,168,56,.08)', bar: 'var(--gold)' }
  if (status === 'today') return { border: 'rgba(127,119,221,.45)', bg: 'rgba(127,119,221,.12)', bar: 'var(--accent)' }
  return { border: 'var(--border)', bg: 'var(--bg2)', bar: 'var(--bg3)' }
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
    let active = true

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace('/auth')
        return
      }

      const result = await getProgramWithWeeks(data.user.id)
      if (!active) return

      if (!result) {
        setNoProgram(true)
        setLoading(false)
        return
      }

      const initialWeek = currentWeekNumber(result.program.started_at)
      const week = result.weeks.find(item => item.week_number === initialWeek) ?? result.weeks[0] ?? null
      const initialDay = week?.days.find(day => day.date === todayStr) ?? week?.days[0] ?? null

      setWeeks(result.weeks)
      setSelectedWeek(initialWeek)
      setSelectedDayId(initialDay?.id ?? null)
      setLoading(false)

      if (initialDay) {
        setDrawerLoading(true)
        try {
          const tasks = await getProgramTasks(initialDay.id)
          if (!active) return
          setDrawerTasks(tasks)
        } catch {
          if (!active) return
          setDrawerError(true)
        } finally {
          if (active) setDrawerLoading(false)
        }
      }
    })

    return () => {
      active = false
    }
  }, [router, todayStr])

  const handleDayClick = async (dayId: string) => {
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
  const selectedDay = currentWeek?.days.find(d => d.id === selectedDayId) ?? null
  const allDays = useMemo(() => weeks.flatMap(w => w.days), [weeks])
  const totalTasks = allDays.reduce((sum, day) => sum + day.task_counts.total, 0)
  const completedTasks = allDays.reduce((sum, day) => sum + day.task_counts.completed, 0)
  const completedDays = allDays.filter(day => day.task_counts.total > 0 && day.task_counts.completed === day.task_counts.total).length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const currentDayNumber = selectedDay?.day_number ?? currentWeek?.days[0]?.day_number ?? 1
  const weekRange = currentWeek?.days.length
    ? `${currentWeek.days[0].day_number} - ${currentWeek.days[currentWeek.days.length - 1].day_number}`
    : ''

  useEffect(() => {
    if (!currentWeek || currentWeek.days.length === 0) return
    if (selectedDayId && currentWeek.days.some(day => day.id === selectedDayId)) return

    const fallbackDay =
      currentWeek.days.find(day => day.date === todayStr) ??
      currentWeek.days[0]

    if (!fallbackDay) return
    handleDayClick(fallbackDay.id)
  }, [currentWeek, selectedDayId, todayStr])

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
          Fazer diagnóstico
        </button>
      </div>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg0)', padding: '28px 24px 40px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <button className="btn-ghost" style={{ minWidth: 120 }} onClick={() => router.back()}>
            Voltar
          </button>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 34, lineHeight: 1, color: 'var(--text1)', marginBottom: 8 }}>
              Seu Programa
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Dia {currentDayNumber} de {allDays.length} | Semana {selectedWeek} | {currentWeek?.theme ?? ''}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Progresso total</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--teal)' }}>{progressPct}%</div>
            </div>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dias concluídos</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--gold)' }}>{completedDays}</div>
            </div>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tasks concluídas</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>
                {completedTasks}/{totalTasks}
              </div>
            </div>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Fase atual</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text1)' }}>{currentWeek?.theme ?? '-'}</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', height: 6, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg, var(--teal), var(--accent))', width: `${progressPct}%`, height: '100%', borderRadius: 999, transition: 'width .5s ease' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 20, alignItems: 'start' }}>
          <section style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <button
                onClick={() => { setSelectedWeek(w => Math.max(1, w - 1)); setSelectedDayId(null) }}
                disabled={selectedWeek === 1}
                className="btn-ghost"
                style={{ minWidth: 44, opacity: selectedWeek === 1 ? 0.4 : 1 }}
              >
                {'<'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--text1)' }}>
                  Semana {selectedWeek}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                  {currentWeek?.theme ?? ''} {weekRange ? `| Dias ${weekRange}` : ''}
                </div>
              </div>

              <button
                onClick={() => { setSelectedWeek(w => Math.min(9, w + 1)); setSelectedDayId(null) }}
                disabled={selectedWeek === 9}
                className="btn-ghost"
                style={{ minWidth: 44, opacity: selectedWeek === 9 ? 0.4 : 1 }}
              >
                {'>'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
              {(currentWeek?.days ?? []).map((day, index) => {
                const status = getDayStatus(day, todayStr)
                const colors = statusColors(status)
                const isSelected = selectedDayId === day.id
                const progress = day.task_counts.total > 0 ? Math.round((day.task_counts.completed / day.task_counts.total) * 100) : 0

                return (
                  <button
                    key={day.id}
                    onClick={() => handleDayClick(day.id)}
                    style={{
                      background: colors.bg,
                      border: `1px solid ${isSelected ? 'var(--accent)' : colors.border}`,
                      borderRadius: 14,
                      padding: '12px 8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      minHeight: 118,
                      transition: 'all .2s ease',
                    }}
                  >
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: status === 'today' ? 'var(--accent)' : 'var(--text3)', marginBottom: 8 }}>
                      {status === 'today' ? 'Hoje' : DAY_LABELS[index]}
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--text1)', marginBottom: 10 }}>
                      {day.day_number}
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: colors.bar, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {day.task_counts.completed}/{day.task_counts.total}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {Array.from({ length: 9 }, (_, index) => (
                <button
                  key={index}
                  onClick={() => { setSelectedWeek(index + 1); setSelectedDayId(null) }}
                  style={{
                    width: index + 1 === selectedWeek ? 18 : 6,
                    height: 6,
                    borderRadius: 999,
                    border: 'none',
                    background: index + 1 === selectedWeek ? 'var(--accent)' : 'var(--bg3)',
                    opacity: index + 1 === selectedWeek ? 1 : 0.55,
                    cursor: 'pointer',
                    transition: 'all .2s ease',
                  }}
                />
              ))}
            </div>
          </section>

          <section style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 18, minHeight: 360 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>
                Planejamento do dia
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text1)', marginBottom: 4 }}>
                {selectedDay
                  ? `${DAY_LABELS[(currentWeek?.days.findIndex(day => day.id === selectedDay.id) ?? 0)]} | Dia ${selectedDay.day_number}`
                  : 'Selecione um dia'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                {selectedDay
                  ? `${new Date(`${selectedDay.date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} | ${currentWeek?.theme ?? ''}`
                  : 'Escolha um dia da semana para ver a estrutura do planejamento.'}
              </div>
            </div>

            {drawerLoading ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando tarefas...</div>
            ) : drawerError ? (
              <div style={{ color: '#E24B4A', fontSize: 13 }}>Erro ao carregar tarefas.</div>
            ) : !selectedDay ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum dia selecionado.</div>
            ) : drawerTasks.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhuma tarefa encontrada para este dia.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drawerTasks.map(task => (
                  <div key={task.id} style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 14 }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>+{task.xp_reward} XP</div>
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.45, marginBottom: 8 }}>{task.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 999, padding: '4px 8px' }}>
                        {AREA_LABELS[task.area] ?? task.area}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 999, padding: '4px 8px' }}>
                        Dificuldade {task.difficulty}
                      </span>
                      <span style={{ fontSize: 11, color: task.status === 'completed' ? 'var(--teal)' : task.status === 'skipped' ? 'var(--gold)' : 'var(--text3)', background: 'var(--bg3)', borderRadius: 999, padding: '4px 8px' }}>
                        {task.status === 'completed' ? 'Concluída' : task.status === 'skipped' ? 'Pulada' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
