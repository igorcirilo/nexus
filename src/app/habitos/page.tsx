'use client'

import { useEffect, useMemo, useState } from 'react'
import Nav from '@/components/Nav'
import HabitosHub from '@/components/habitos/HabitosHub'
import { supabase, getHabitsWithLogs, toggleHabitLog } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { Habit, HabitArea } from '@/types'

type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

function getLocalDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

const AREAS = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const DEFAULT_HABITS: Omit<Habit, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Treino fisico', area: 'corpo', xp_reward: 20, time_window: '07:00-09:00', active: true },
  { name: 'Agua · 2L', area: 'corpo', xp_reward: 8, time_window: 'Todo o dia', active: true },
  { name: 'Idioma · 20 min', area: 'idiomas', xp_reward: 15, time_window: '18:00-19:00', active: true },
  { name: 'Leitura · 15 min', area: 'carreira', xp_reward: 10, time_window: '21:00-22:00', active: true },
  { name: 'Meditacao', area: 'emocoes', xp_reward: 8, time_window: '07:30-08:00', active: true },
  { name: 'Bloco de foco', area: 'produtividade', xp_reward: 15, time_window: '09:00-11:00', active: true },
]

const DIFFICULTY_XP = {
  facil: 8,
  media: 15,
  dificil: 24,
} as const

const SUGGESTIONS: Record<HabitArea, Array<{ name: string; difficulty: keyof typeof DIFFICULTY_XP; time_window?: string }>> = {
  corpo: [
    { name: 'Caminhada de 20 min', difficulty: 'facil', time_window: 'Manha' },
    { name: 'Treino completo', difficulty: 'dificil', time_window: '07:00-08:30' },
    { name: 'Alongamento + mobilidade', difficulty: 'media', time_window: 'Fim do dia' },
  ],
  produtividade: [
    { name: 'Bloco de foco 50 min', difficulty: 'media', time_window: '09:00-10:00' },
    { name: 'Planeamento do dia', difficulty: 'facil', time_window: 'Manha' },
    { name: 'Fechar a tarefa principal', difficulty: 'dificil', time_window: 'Tarde' },
  ],
  idiomas: [
    { name: 'Licao de idioma 15 min', difficulty: 'facil', time_window: 'Noite' },
    { name: 'Conversacao 30 min', difficulty: 'dificil', time_window: '18:00-18:30' },
    { name: 'Revisao de vocabulario', difficulty: 'media', time_window: 'Almoco' },
  ],
  carreira: [
    { name: 'Leitura tecnica 20 min', difficulty: 'media', time_window: 'Noite' },
    { name: 'Projeto portfolio', difficulty: 'dificil', time_window: 'Tarde' },
    { name: 'Atualizar CV ou LinkedIn', difficulty: 'facil', time_window: 'Fim do dia' },
  ],
  financas: [
    { name: 'Registar despesas do dia', difficulty: 'facil', time_window: 'Noite' },
    { name: 'Revisao semanal de contas', difficulty: 'media', time_window: 'Domingo' },
    { name: 'Estudo de investimento', difficulty: 'dificil', time_window: '20:00-20:30' },
  ],
  emocoes: [
    { name: 'Respiracao guiada 5 min', difficulty: 'facil', time_window: 'Manha' },
    { name: 'Journaling emocional', difficulty: 'media', time_window: 'Noite' },
    { name: 'Meditacao 20 min', difficulty: 'dificil', time_window: 'Fim do dia' },
  ],
  relacionamentos: [
    { name: 'Mensagem a alguem importante', difficulty: 'facil', time_window: 'Tarde' },
    { name: 'Chamada de 15 min', difficulty: 'media', time_window: 'Noite' },
    { name: 'Tempo de qualidade sem telemovel', difficulty: 'dificil', time_window: 'Jantar' },
  ],
}

type Difficulty = keyof typeof DIFFICULTY_XP
type FormState = {
  name: string
  area: HabitArea
  xp_reward: number
  time_window: string
  difficulty: Difficulty
}

const EMPTY: FormState = { name: '', area: 'corpo', xp_reward: DIFFICULTY_XP.media, time_window: '', difficulty: 'media' }

const S: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '12px 14px',
  color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 14,
  outline: 'none',
}

function difficultyFromXP(xp: number): Difficulty {
  if (xp >= DIFFICULTY_XP.dificil) return 'dificil'
  if (xp <= DIFFICULTY_XP.facil) return 'facil'
  return 'media'
}

export default function HabitosPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [filterArea, setFilterArea] = useState<HabitArea | 'all'>('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [mode, setMode] = useState<'tracker' | 'gerir'>('tracker')
  const [todayHabits, setTodayHabits] = useState<HabitWithLog[]>([])
  const today = getLocalDate()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUserId(user.id)
      const date = getLocalDate()
      const [{ data }, todays] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).order('area').order('name'),
        getHabitsWithLogs(user.id, date),
      ])
      setHabits(data ?? [])
      setTodayHabits((todays ?? []) as HabitWithLog[])
    })
  }, [])

  async function toggleToday(habitId: string, done: boolean) {
    if (!userId) return
    setTodayHabits((cur) => cur.map((h) => (h.id === habitId ? { ...h, habit_logs: [{ completed: done, date: today }] } : h)))
    await toggleHabitLog(userId, habitId, today, done)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function applyDifficulty(difficulty: Difficulty) {
    setForm((current) => ({ ...current, difficulty, xp_reward: DIFFICULTY_XP[difficulty] }))
  }

  function applySuggestion(name: string, difficulty: Difficulty, time_window = '') {
    setForm((current) => ({
      ...current,
      name,
      difficulty,
      xp_reward: DIFFICULTY_XP[difficulty],
      time_window: time_window || current.time_window,
    }))
  }

  function openNew() {
    setEditHabit(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(h: Habit) {
    setEditHabit(h)
    setForm({
      name: h.name,
      area: h.area,
      xp_reward: h.xp_reward,
      time_window: h.time_window ?? '',
      difficulty: difficultyFromXP(h.xp_reward),
    })
    setShowForm(true)
  }

  async function save() {
    if (!userId || !form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      area: form.area,
      xp_reward: form.xp_reward,
      time_window: form.time_window.trim() || null,
    }

    if (editHabit) {
      const { data } = await supabase.from('habits').update(payload).eq('id', editHabit.id).select().single()
      if (data) setHabits((current) => current.map((item) => (item.id === editHabit.id ? (data as Habit) : item)))
      showToast('Habito actualizado!')
    } else {
      const { data } = await supabase.from('habits').insert({ ...payload, user_id: userId }).select().single()
      if (data) setHabits((current) => [...current, data as Habit])
      showToast('Habito criado!')
    }

    setShowForm(false)
    setSaving(false)
  }

  async function toggleActive(h: Habit) {
    const active = !h.active
    await supabase.from('habits').update({ active }).eq('id', h.id)
    setHabits((current) => current.map((item) => (item.id === h.id ? { ...item, active } : item)))
  }

  async function remove(id: string) {
    await supabase.from('habits').delete().eq('id', id)
    setHabits((current) => current.filter((item) => item.id !== id))
    showToast('Habito removido.')
  }

  async function addDefaults() {
    if (!userId) return
    setSaving(true)
    const { data } = await supabase.from('habits').insert(DEFAULT_HABITS.map((habit) => ({ ...habit, user_id: userId }))).select()
    if (data) setHabits((current) => [...current, ...(data as Habit[])])
    showToast('Habitos de exemplo adicionados!')
    setSaving(false)
  }

  const filtered = filterArea === 'all' ? habits : habits.filter((habit) => habit.area === filterArea)
  const activeCount = habits.filter((habit) => habit.active).length
  const totalXP = habits.filter((habit) => habit.active).reduce((total, habit) => total + habit.xp_reward, 0)
  const suggestions = useMemo(() => SUGGESTIONS[form.area], [form.area])

  const byArea = AREAS.map(([key, meta]) => ({
    key,
    meta,
    items: filtered.filter((habit) => habit.area === key),
  })).filter((group) => group.items.length > 0)

  // ── Dados do tracker diário (hub fiel ao mockup) ──
  const todayList = todayHabits.map((h) => ({
    id: h.id,
    name: h.name,
    area: h.area as string,
    xp_reward: h.xp_reward,
    time_window: h.time_window ?? null,
    done: h.habit_logs?.[0]?.completed ?? false,
  }))
  const doneToday = todayList.filter((h) => h.done).length
  const totalToday = todayList.length
  const areasAgg = AREAS.map(([key, meta]) => {
    const items = todayList.filter((h) => h.area === key)
    const done = items.filter((h) => h.done).length
    return { key: key as string, label: meta.label, color: meta.color, done, total: items.length, pct: items.length > 0 ? Math.round((done / items.length) * 100) : 0 }
  }).filter((a) => a.total > 0)

  // Modo tracker: hub full-bleed fiel ao mockup (check diário). "Gerir" abre o CRUD atual.
  if (mode === 'tracker') {
    return (
      <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
        <HabitosHub
          habits={todayList}
          areas={areasAgg}
          doneToday={doneToday}
          totalToday={totalToday}
          onToggle={toggleToday}
          onManage={() => setMode('gerir')}
        />
        <Nav />
      </main>
    )
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg2)',
            border: '0.5px solid rgba(30,203,180,.38)',
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13,
            color: 'var(--teal)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 200,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Habitos</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
            <span>{activeCount} activos</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: 'var(--gold)' }}>+{totalXP} XP/dia possivel</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setMode('tracker')}
            aria-label="Voltar ao tracker de hoje"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            onClick={() => setView((current) => (current === 'list' ? 'grid' : 'list'))}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}
          >
            {view === 'list'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            }
          </button>
          <button
            onClick={openNew}
            style={{
              background: 'var(--gold)',
              color: 'var(--bg0)',
              border: 'none',
              borderRadius: 12,
              padding: '9px 16px',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            + Novo
          </button>
        </div>
      </div>

      {habits.length === 0 && (
        <div style={{ margin: '20px 20px 0', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 18, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>H</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Sem habitos ainda</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Comeca com exemplos prontos ou cria os teus proprios.
          </p>
          <button
            onClick={addDefaults}
            disabled={saving}
            style={{
              width: '100%',
              background: 'var(--gold)',
              color: 'var(--bg0)',
              border: 'none',
              borderRadius: 14,
              padding: 14,
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            {saving ? 'A adicionar...' : 'Adicionar habitos de exemplo'}
          </button>
          <button
            onClick={openNew}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'var(--accent)',
              border: '0.5px solid rgba(127,119,221,.3)',
              borderRadius: 14,
              padding: 14,
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Criar personalizado
          </button>
        </div>
      )}

      {habits.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[['all', 'Todos', '', 'var(--gold)'], ...AREAS.map(([key, meta]) => [key, meta.label, meta.icon, meta.color])].map(([key, label, icon, color]) => {
              const active = filterArea === key
              return (
                <button
                  key={key}
                  onClick={() => setFilterArea(key as HabitArea | 'all')}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    borderRadius: 100,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'DM Sans, sans-serif',
                    background: active ? color : 'var(--bg2)',
                    color: active ? (key === 'all' ? 'var(--bg0)' : '#0D0F14') : 'var(--text3)',
                    outline: active ? 'none' : '0.5px solid var(--border)',
                  }}
                >
                  {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
                  {label}
                </button>
              )
            })}
          </div>

          <div style={{ padding: '10px 20px 14px', fontSize: 11, color: 'var(--text3)' }}>
            {filtered.length} habito{filtered.length !== 1 ? 's' : ''}
          </div>

          {view === 'list' && (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((habit) => {
                const area = AREA_META[habit.area]
                return (
                  <div
                    key={habit.id}
                    style={{
                      background: 'var(--bg2)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      opacity: habit.active ? 1 : 0.45,
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${area.color}18`, flexShrink: 0 }}>
                      {area.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => openEdit(habit)}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 5, cursor: 'pointer' }}>{habit.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{area.label}</span>
                        {habit.time_window && (
                          <span style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 6 }}>
                            {habit.time_window}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                          +{habit.xp_reward} XP
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => toggleActive(habit)} style={{ width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer', background: habit.active ? 'var(--teal)' : 'var(--bg3)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 4, width: 16, height: 16, borderRadius: '50%', background: 'white', left: habit.active ? 'calc(100% - 20px)' : '4px' }} />
                      </button>
                      <button onClick={() => openEdit(habit)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => remove(habit.id)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'grid' && (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {byArea.map(({ key, meta, items }) => (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {items.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {items.map((habit) => (
                      <div
                        key={habit.id}
                        onClick={() => openEdit(habit)}
                        style={{
                          background: 'var(--bg2)',
                          border: `0.5px solid ${habit.active ? `${meta.color}30` : 'var(--border)'}`,
                          borderRadius: 14,
                          padding: '14px 14px 12px',
                          opacity: habit.active ? 1 : 0.45,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 20, marginBottom: 8 }}>{meta.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', marginBottom: 4, lineHeight: 1.3 }}>{habit.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {habit.time_window ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>{habit.time_window}</span> : <span />}
                          <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>+{habit.xp_reward}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.65)' }}
          onClick={(event) => event.target === event.currentTarget && setShowForm(false)}
        >
          <div style={{ width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>{editHabit ? 'Editar habito' : 'Novo habito'}</h2>
                <button onClick={() => setShowForm(false)} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer' }}>X</button>
              </div>

              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Nome</label>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Treino, Leitura, Idioma..." style={{ ...S, marginBottom: 16 }} />

              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Area da vida</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {AREAS.map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setForm((current) => ({ ...current, area: key }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      textAlign: 'left',
                      background: form.area === key ? `${meta.color}18` : 'var(--bg2)',
                      color: form.area === key ? meta.color : 'var(--text2)',
                      outline: form.area === key ? `0.5px solid ${meta.color}` : '0.5px solid var(--border)',
                    }}
                  >
                    <span>{meta.icon}</span>
                    {meta.label}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Sugestoes para esta area</label>
              <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {suggestions.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => applySuggestion(item.name, item.difficulty, item.time_window)}
                    style={{
                      textAlign: 'left',
                      background: 'var(--bg2)',
                      color: 'var(--text2)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 12,
                      padding: '11px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {item.time_window ?? 'Qualquer hora'} · {item.difficulty} · {DIFFICULTY_XP[item.difficulty]} XP
                    </div>
                  </button>
                ))}
              </div>

              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Melhor hora (opcional)</label>
              <input value={form.time_window} onChange={(event) => setForm((current) => ({ ...current, time_window: event.target.value }))} placeholder="Ex: 07:00-08:00 ou Manha" style={{ ...S, marginBottom: 16 }} />

              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Dificuldade</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {([
                  { key: 'facil', label: 'Facil', hint: 'rapido' },
                  { key: 'media', label: 'Media', hint: 'consistente' },
                  { key: 'dificil', label: 'Dificil', hint: 'mais exigente' },
                ] as Array<{ key: Difficulty; label: string; hint: string }>).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => applyDifficulty(item.key)}
                    style={{
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px 10px',
                      cursor: 'pointer',
                      background: form.difficulty === item.key ? 'rgba(232,168,56,.12)' : 'var(--bg2)',
                      outline: form.difficulty === item.key ? '1.5px solid var(--gold)' : '0.5px solid var(--border)',
                      color: form.difficulty === item.key ? 'var(--gold)' : 'var(--text2)',
                    }}
                  >
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 10, marginTop: 4 }}>{item.hint}</div>
                    <div style={{ fontSize: 11, marginTop: 6 }}>+{DIFFICULTY_XP[item.key]} XP</div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text3)' }}>XP por conclusao</label>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>{form.xp_reward} XP</span>
              </div>
            </div>

            <div style={{ padding: '12px 24px 48px', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)' }}>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                style={{
                  width: '100%',
                  background: form.name.trim() ? 'var(--gold)' : 'var(--bg3)',
                  color: form.name.trim() ? 'var(--bg0)' : 'var(--text3)',
                  border: 'none',
                  borderRadius: 14,
                  padding: 14,
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'A guardar...' : editHabit ? 'Guardar alteracoes' : 'Criar habito'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
