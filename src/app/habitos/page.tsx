'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Nav from '@/components/Nav'
import HabitosHub from '@/components/habitos/HabitosHub'
import { supabase, getHabitsWithLogs, toggleHabitLog } from '@/lib/supabase'
import { todayISO } from '@/lib/date'
import { AREA_META } from '@/types'
import type { Habit, HabitArea } from '@/types'

type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

const FONT = 'Inter, sans-serif'

const AREAS = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

// Apenas os campos definidos no insert; source/difficulty/catalog_key usam os defaults da BD.
const DEFAULT_HABITS: Pick<Habit, 'name' | 'area' | 'xp_reward' | 'time_window' | 'active'>[] = [
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

const TIME_PRESETS = [
  { key: 'Manhã', icon: '🌅' },
  { key: 'Tarde', icon: '☀️' },
  { key: 'Noite', icon: '🌙' },
]

type Difficulty = keyof typeof DIFFICULTY_XP
type FormState = {
  name: string
  area: HabitArea
  xp_reward: number
  time_window: string
  difficulty: Difficulty
  active: boolean
}

const EMPTY: FormState = { name: '', area: 'corpo', xp_reward: DIFFICULTY_XP.media, time_window: '', difficulty: 'media', active: true }

function difficultyFromXP(xp: number): Difficulty {
  if (xp >= DIFFICULTY_XP.dificil) return 'dificil'
  if (xp <= DIFFICULTY_XP.facil) return 'facil'
  return 'media'
}

// ── estilos do bottom sheet (design do hub) ──
const sheetInput: CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid rgba(var(--ink-rgb),0.10)',
  borderRadius: 13,
  padding: '13px 14px',
  color: 'var(--text1)',
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
}

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  display: 'block',
  margin: '16px 0 8px',
}

export default function HabitosPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Habit | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [todayHabits, setTodayHabits] = useState<HabitWithLog[]>([])
  const today = todayISO()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUserId(user.id)
      await reload(user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload(uid: string) {
    const date = todayISO()
    const [{ data }, todays] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', uid).order('area').order('name'),
      getHabitsWithLogs(uid, date),
    ])
    setHabits(data ?? [])
    setTodayHabits((todays ?? []) as HabitWithLog[])
  }

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

  function openEdit(habitId: string) {
    const h = habits.find((x) => x.id === habitId)
    if (!h) return
    setEditHabit(h)
    setForm({
      name: h.name,
      area: h.area,
      xp_reward: h.xp_reward,
      time_window: h.time_window ?? '',
      difficulty: difficultyFromXP(h.xp_reward),
      active: h.active,
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
      active: form.active,
    }

    if (editHabit) {
      await supabase.from('habits').update(payload).eq('id', editHabit.id)
      showToast('Hábito atualizado!')
    } else {
      await supabase.from('habits').insert({ ...payload, user_id: userId })
      showToast('Hábito criado!')
    }

    await reload(userId)
    setShowForm(false)
    setSaving(false)
  }

  function requestDelete(habitId: string) {
    const h = habits.find((x) => x.id === habitId)
    if (h) setConfirmDelete(h)
  }

  async function remove() {
    if (!userId || !confirmDelete) return
    await supabase.from('habits').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    setShowForm(false)
    await reload(userId)
    showToast('Hábito removido.')
  }

  async function addDefaults() {
    if (!userId) return
    setSaving(true)
    await supabase.from('habits').insert(DEFAULT_HABITS.map((habit) => ({ ...habit, user_id: userId })))
    await reload(userId)
    showToast('Hábitos de exemplo adicionados!')
    setSaving(false)
  }

  const suggestions = useMemo(() => SUGGESTIONS[form.area], [form.area])

  // ── Dados do tracker diário ──
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
    return { key: key as string, label: meta.label, icon: meta.icon, color: meta.color, done, total: items.length, pct: items.length > 0 ? Math.round((done / items.length) * 100) : 0 }
  }).filter((a) => a.total > 0)

  const timeIsPreset = TIME_PRESETS.some((t) => t.key === form.time_window)
  const inactiveHabits = habits.filter((h) => !h.active)

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: 'var(--surface-page)' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-pop)',
            border: '1px solid rgba(0,200,150,.38)',
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13,
            fontFamily: FONT,
            color: '#00C896',
            zIndex: 10000,
            whiteSpace: 'nowrap',
          }}
        >
          ✓ {toast}
        </div>
      )}

      <HabitosHub
        habits={todayList}
        areas={areasAgg}
        doneToday={doneToday}
        totalToday={totalToday}
        onToggle={toggleToday}
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={requestDelete}
      />

      {/* Hábitos inativos: reativáveis via edição */}
      {inactiveHabits.length > 0 && (
        <div style={{ padding: '0 22px', fontFamily: FONT }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', margin: '18px 0 10px' }}>
            Inativos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inactiveHabits.map((h) => (
              <button
                key={h.id}
                onClick={() => openEdit(h.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(var(--ink-rgb),0.06)',
                  borderRadius: 16,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  opacity: 0.6,
                }}
              >
                <span style={{ fontSize: 15 }}>{AREA_META[h.area]?.icon}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {h.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5C842', flexShrink: 0 }}>reativar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state: sem hábitos de todo */}
      {habits.length === 0 && (
        <div style={{ margin: '0 22px', fontFamily: FONT }}>
          <button
            onClick={addDefaults}
            disabled={saving}
            style={{
              width: '100%',
              background: 'var(--surface-2)',
              color: 'var(--text1)',
              border: '1px dashed rgba(var(--ink-rgb),0.15)',
              borderRadius: 14,
              padding: 14,
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {saving ? 'A adicionar…' : 'Adicionar hábitos de exemplo'}
          </button>
        </div>
      )}

      {/* ── Bottom sheet: novo / editar hábito ── */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)' }}
          onClick={(event) => event.target === event.currentTarget && setShowForm(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 448,
              margin: '0 auto',
              background: 'var(--surface-card)',
              borderRadius: '24px 24px 0 0',
              borderTop: '1px solid rgba(var(--ink-rgb),0.12)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'min(86dvh, 720px)',
              fontFamily: FONT,
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 0', flexShrink: 0 }} />

            {/* Header fixo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.3px' }}>
                {editHabit ? 'Editar hábito' : 'Novo hábito'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Fechar"
                style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', border: 'none', cursor: 'pointer', color: 'var(--text1)', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {/* Corpo scrollável */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px 16px' }}>
              <label style={{ ...fieldLabel, marginTop: 12 }}>Nome do hábito</label>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Treino, Leitura, Idioma…" style={sheetInput} />

              <label style={fieldLabel}>Área</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {AREAS.map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setForm((current) => ({ ...current, area: key }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 13,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: FONT,
                      fontWeight: 600,
                      textAlign: 'left',
                      background: form.area === key ? `${meta.color}18` : 'rgba(var(--ink-rgb),0.03)',
                      color: form.area === key ? meta.color : 'var(--text2)',
                      border: form.area === key ? `1px solid ${meta.color}77` : '1px solid rgba(var(--ink-rgb),0.10)',
                    }}
                  >
                    <span>{meta.icon}</span>
                    {meta.label}
                  </button>
                ))}
              </div>

              <label style={fieldLabel}>Horário</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TIME_PRESETS.map((t) => {
                  const active = form.time_window === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setForm((current) => ({ ...current, time_window: active ? '' : t.key }))}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        padding: '10px 8px',
                        borderRadius: 13,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontFamily: FONT,
                        fontWeight: 600,
                        background: active ? 'rgba(245,200,66,0.10)' : 'rgba(var(--ink-rgb),0.03)',
                        color: active ? '#F5C842' : 'rgba(var(--ink-rgb),0.55)',
                        border: active ? '1px solid rgba(245,200,66,0.45)' : '1px solid rgba(var(--ink-rgb),0.10)',
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
                      {t.key}
                    </button>
                  )
                })}
              </div>
              <input
                value={timeIsPreset ? '' : form.time_window}
                onChange={(event) => setForm((current) => ({ ...current, time_window: event.target.value }))}
                placeholder="Ou define: ex. 18:00-19:30"
                style={{ ...sheetInput, marginTop: 8 }}
              />

              <label style={fieldLabel}>Dificuldade</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { key: 'facil', label: 'Fácil' },
                  { key: 'media', label: 'Média' },
                  { key: 'dificil', label: 'Difícil' },
                ] as Array<{ key: Difficulty; label: string }>).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => applyDifficulty(item.key)}
                    style={{
                      borderRadius: 13,
                      padding: '12px 8px',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      background: form.difficulty === item.key ? 'rgba(245,200,66,0.10)' : 'rgba(var(--ink-rgb),0.03)',
                      border: form.difficulty === item.key ? '1px solid rgba(245,200,66,0.45)' : '1px solid rgba(var(--ink-rgb),0.10)',
                      color: form.difficulty === item.key ? '#F5C842' : 'rgba(var(--ink-rgb),0.55)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                  </button>
                ))}
              </div>

              <label style={fieldLabel}>Sugestões para esta área</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {suggestions.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => applySuggestion(item.name, item.difficulty, item.time_window)}
                    style={{
                      textAlign: 'left',
                      background: 'var(--surface-2)',
                      border: '1px solid rgba(var(--ink-rgb),0.08)',
                      borderRadius: 13,
                      padding: '11px 12px',
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {item.time_window ?? 'Qualquer hora'} · {item.difficulty}
                    </div>
                  </button>
                ))}
              </div>

              {editHabit && (
                <>
                  <button
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    style={{
                      marginTop: 18,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: 'var(--surface-2)',
                      border: '1px solid rgba(var(--ink-rgb),0.10)',
                      borderRadius: 13,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 700, color: 'var(--text1)' }}>
                      Hábito ativo
                    </span>
                    <span style={{
                      width: 44, height: 26, borderRadius: 13, position: 'relative', flexShrink: 0,
                      background: form.active ? '#00D4C8' : 'rgba(var(--ink-rgb),0.1)',
                      transition: 'background .2s',
                    }}>
                      <span style={{
                        position: 'absolute', top: 3,
                        left: form.active ? 'auto' : 3,
                        right: form.active ? 3 : 'auto',
                        width: 20, height: 20, borderRadius: '50%',
                        background: form.active ? 'var(--surface-page)' : 'rgba(var(--ink-rgb),0.4)',
                      }} />
                    </span>
                  </button>

                  <button
                    onClick={() => setConfirmDelete(editHabit)}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid rgba(226,75,74,0.25)',
                      borderRadius: 13,
                      padding: '13px 14px',
                      background: 'transparent',
                      color: '#E24B4A',
                      fontSize: 13.5,
                      fontWeight: 700,
                      fontFamily: FONT,
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                    Apagar hábito
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'rgba(226,75,74,0.6)' }}>pede confirmação</span>
                  </button>
                </>
              )}
            </div>

            {/* Footer fixo */}
            <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: 'var(--surface-card)', borderTop: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                style={{
                  width: '100%',
                  background: form.name.trim() ? 'linear-gradient(135deg, #F5C842, #E0A82A)' : 'rgba(var(--ink-rgb),0.06)',
                  color: form.name.trim() ? '#1A1200' : 'rgba(var(--ink-rgb),0.35)',
                  border: 'none',
                  borderRadius: 15,
                  padding: 15,
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'A guardar…' : editHabit ? 'Guardar alterações' : 'Criar hábito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação de apagar ── */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', padding: 24 }}
          onClick={(event) => event.target === event.currentTarget && setConfirmDelete(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--surface-pop)', border: '1px solid rgba(var(--ink-rgb),0.12)', borderRadius: 20, padding: '22px 20px', fontFamily: FONT }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Apagar hábito?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18, overflowWrap: 'anywhere' }}>
              “{confirmDelete.name}” e o seu histórico de conclusões vão ser removidos. Esta ação é irreversível.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(var(--ink-rgb),0.12)', background: 'var(--surface-2)', color: 'var(--text1)', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={remove}
                style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: 'none', background: '#E24B4A', color: 'var(--on-accent)', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
