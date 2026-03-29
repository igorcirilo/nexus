'use client'
// src/app/habitos/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { Habit, HabitArea } from '@/types'

const AREAS = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const DEFAULT_HABITS: Omit<Habit, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Treino físico',    area: 'corpo',         xp_reward: 50, time_window: '07:00–09:00', active: true },
  { name: 'Água · 2L',       area: 'corpo',         xp_reward: 25, time_window: 'Todo o dia',  active: true },
  { name: 'Idioma · 20 min', area: 'idiomas',       xp_reward: 30, time_window: '18:00–19:00', active: true },
  { name: 'Leitura · 15 min',area: 'carreira',      xp_reward: 20, time_window: '21:00–22:00', active: true },
  { name: 'Meditação',       area: 'emocoes',       xp_reward: 20, time_window: '07:30–08:00', active: true },
  { name: 'Bloco de foco',   area: 'produtividade', xp_reward: 40, time_window: '09:00–11:00', active: true },
]

type FormState = {
  name: string
  area: HabitArea
  xp_reward: number
  time_window: string
}

const EMPTY_FORM: FormState = { name: '', area: 'corpo', xp_reward: 20, time_window: '' }

export default function HabitosPage() {
  const [habits, setHabits]     = useState<Habit[]>([])
  const [userId, setUserId]     = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [filterArea, setFilterArea] = useState<HabitArea | 'all'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')
      setHabits(data ?? [])
    }
    load()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function saveHabit() {
    if (!userId || !form.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('habits')
      .insert({ ...form, user_id: userId })
      .select()
      .single()
    if (!error && data) {
      setHabits(h => [...h, data as Habit])
      setForm(EMPTY_FORM)
      setShowForm(false)
      showToast('Hábito criado!')
    }
    setSaving(false)
  }

  async function toggleActive(habit: Habit) {
    const newVal = !habit.active
    await supabase.from('habits').update({ active: newVal }).eq('id', habit.id)
    setHabits(h => h.map(x => x.id === habit.id ? { ...x, active: newVal } : x))
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    showToast('Hábito removido.')
  }

  async function addDefaults() {
    if (!userId) return
    setSaving(true)
    const rows = DEFAULT_HABITS.map(h => ({ ...h, user_id: userId }))
    const { data } = await supabase.from('habits').insert(rows).select()
    if (data) setHabits(h => [...h, ...(data as Habit[])])
    showToast('Hábitos de exemplo adicionados!')
    setSaving(false)
  }

  const filtered = filterArea === 'all'
    ? habits
    : habits.filter(h => h.area === filterArea)

  return (
    <main className="animate-in pb-28">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 pointer-events-none -translate-x-1/2
                        px-4 py-2.5 rounded-xl text-[13px] flex items-center gap-2"
             style={{ background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)', color: 'var(--teal)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-7 flex items-center justify-between mb-4">
        <div>
          <h1 className="font-syne font-bold text-[22px]">Hábitos</h1>
          <p className="text-[12px] text-text-3 mt-0.5">{habits.filter(h => h.active).length} activos · {habits.length} total</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-semibold text-[13px] transition-all"
          style={{ background: 'var(--gold)', color: 'var(--bg0)' }}>
          + Novo
        </button>
      </div>

      {/* Estado vazio */}
      {habits.length === 0 && (
        <div className="mx-5 card p-6 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <div className="font-syne font-semibold text-[16px] mb-2">Sem hábitos ainda</div>
          <p className="text-[13px] text-text-2 mb-5 leading-relaxed">
            Começa com exemplos prontos ou cria os teus próprios hábitos.
          </p>
          <button onClick={addDefaults} disabled={saving}
            className="btn-primary mb-3">
            {saving ? 'A adicionar…' : 'Adicionar hábitos de exemplo'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="btn-ghost">
            Criar hábito personalizado
          </button>
        </div>
      )}

      {/* Filtro por área */}
      {habits.length > 0 && (
        <div className="px-5 mb-4 flex gap-2 overflow-x-auto pb-1"
             style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterArea('all')}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] transition-all"
            style={{
              background: filterArea === 'all' ? 'var(--gold)' : 'var(--bg2)',
              color: filterArea === 'all' ? 'var(--bg0)' : 'var(--text3)',
              border: '0.5px solid var(--border)',
            }}>
            Todos
          </button>
          {AREAS.map(([key, meta]) => (
            <button key={key} onClick={() => setFilterArea(key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all"
              style={{
                background: filterArea === key ? meta.color : 'var(--bg2)',
                color: filterArea === key ? '#0D0F14' : 'var(--text3)',
                border: '0.5px solid var(--border)',
              }}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista de hábitos */}
      {filtered.length > 0 && (
        <div className="px-5 flex flex-col gap-2">
          {filtered.map(h => {
            const area = AREA_META[h.area]
            return (
              <div key={h.id} className="card p-4 flex items-start gap-3"
                   style={{ opacity: h.active ? 1 : 0.5 }}>
                {/* Área icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                     style={{ background: `${area.color}18` }}>
                  {area.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] text-text-1 truncate">{h.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-text-3">{area.label}</span>
                    {h.time_window && (
                      <span className="text-[10px] bg-bg-3 px-1.5 py-0.5 rounded-md text-text-3">
                        {h.time_window}
                      </span>
                    )}
                    <span className="text-[11px]" style={{ color: 'var(--gold)' }}>+{h.xp_reward} XP</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle active */}
                  <button onClick={() => toggleActive(h)}
                    className="w-11 h-6 rounded-full transition-all relative"
                    style={{ background: h.active ? 'var(--teal)' : 'var(--bg3)' }}>
                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                         style={{ left: h.active ? 'calc(100% - 20px)' : '4px' }} />
                  </button>
                  {/* Delete */}
                  <button onClick={() => deleteHabit(h.id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: 'var(--bg3)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="var(--text3)" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário de novo hábito */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end"
             style={{ background: 'rgba(0,0,0,.6)' }}
             onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-3xl p-6 animate-in"
               style={{ background: 'var(--bg1)', borderTop: '0.5px solid var(--border)' }}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne font-bold text-[18px]">Novo hábito</h2>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--bg3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="var(--text2)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Nome */}
            <label className="text-[12px] text-text-3 mb-1.5 block">Nome do hábito</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Treino, Leitura, Idioma…"
              className="w-full rounded-xl p-3.5 text-[14px] mb-4"
              style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />

            {/* Área */}
            <label className="text-[12px] text-text-3 mb-1.5 block">Área da vida</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AREAS.map(([key, meta]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, area: key }))}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-all text-left"
                  style={{
                    border: form.area === key ? `0.5px solid ${meta.color}` : '0.5px solid var(--border)',
                    background: form.area === key ? `${meta.color}14` : 'var(--bg2)',
                    color: form.area === key ? meta.color : 'var(--text2)',
                  }}>
                  <span>{meta.icon}</span> {meta.label}
                </button>
              ))}
            </div>

            {/* Janela de tempo */}
            <label className="text-[12px] text-text-3 mb-1.5 block">Melhor hora (opcional)</label>
            <input value={form.time_window}
              onChange={e => setForm(f => ({ ...f, time_window: e.target.value }))}
              placeholder="Ex: 07:00–08:00 ou Manhã"
              className="w-full rounded-xl p-3.5 text-[14px] mb-4"
              style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />

            {/* XP */}
            <label className="text-[12px] text-text-3 mb-1.5 block">
              XP por conclusão: <strong className="font-syne text-[15px]" style={{ color: 'var(--gold)' }}>{form.xp_reward}</strong>
            </label>
            <input type="range" min={10} max={100} step={5} value={form.xp_reward}
              onChange={e => setForm(f => ({ ...f, xp_reward: +e.target.value }))}
              style={{ width: '100%', accentColor: 'var(--gold)', marginBottom: '20px' }} />

            <button onClick={saveHabit} disabled={saving || !form.name.trim()}
              className="btn-primary"
              style={{ opacity: form.name.trim() ? 1 : 0.5 }}>
              {saving ? 'A guardar…' : 'Guardar hábito'}
            </button>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
