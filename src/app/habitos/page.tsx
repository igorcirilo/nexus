'use client'
// src/app/habitos/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { Habit, HabitArea } from '@/types'

const AREAS = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const DEFAULT_HABITS: Omit<Habit, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Treino físico',    area: 'corpo',         xp_reward: 20, time_window: '07:00–09:00', active: true },
  { name: 'Água · 2L',       area: 'corpo',         xp_reward: 8,  time_window: 'Todo o dia',  active: true },
  { name: 'Idioma · 20 min', area: 'idiomas',       xp_reward: 15, time_window: '18:00–19:00', active: true },
  { name: 'Leitura · 15 min',area: 'carreira',      xp_reward: 10, time_window: '21:00–22:00', active: true },
  { name: 'Meditação',       area: 'emocoes',       xp_reward: 8,  time_window: '07:30–08:00', active: true },
  { name: 'Bloco de foco',   area: 'produtividade', xp_reward: 15, time_window: '09:00–11:00', active: true },
]

type FormState = { name: string; area: HabitArea; xp_reward: number; time_window: string }
const EMPTY: FormState = { name: '', area: 'corpo', xp_reward: 10, time_window: '' }

const S: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}

export default function HabitosPage() {
  const [habits,     setHabits]     = useState<Habit[]>([])
  const [userId,     setUserId]     = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [editHabit,  setEditHabit]  = useState<Habit | null>(null)
  const [form,       setForm]       = useState<FormState>(EMPTY)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')
  const [filterArea, setFilterArea] = useState<HabitArea | 'all'>('all')
  const [view,       setView]       = useState<'list' | 'grid'>('list')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      const { data } = await supabase.from('habits').select('*').eq('user_id', user.id).order('area').order('name')
      setHabits(data ?? [])
    })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2400) }

  function openNew()       { setEditHabit(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(h: Habit) {
    setEditHabit(h)
    setForm({ name: h.name, area: h.area, xp_reward: h.xp_reward, time_window: h.time_window ?? '' })
    setShowForm(true)
  }

  async function save() {
    if (!userId || !form.name.trim()) return
    setSaving(true)
    if (editHabit) {
      const { data } = await supabase.from('habits').update(form).eq('id', editHabit.id).select().single()
      if (data) setHabits(h => h.map(x => x.id === editHabit.id ? data as Habit : x))
      showToast('Hábito actualizado!')
    } else {
      const { data } = await supabase.from('habits').insert({ ...form, user_id: userId }).select().single()
      if (data) setHabits(h => [...h, data as Habit])
      showToast('Hábito criado!')
    }
    setShowForm(false)
    setSaving(false)
  }

  async function toggleActive(h: Habit) {
    const v = !h.active
    await supabase.from('habits').update({ active: v }).eq('id', h.id)
    setHabits(hs => hs.map(x => x.id === h.id ? { ...x, active: v } : x))
  }

  async function remove(id: string) {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    showToast('Hábito removido.')
  }

  async function addDefaults() {
    if (!userId) return
    setSaving(true)
    const { data } = await supabase.from('habits').insert(DEFAULT_HABITS.map(h => ({ ...h, user_id: userId }))).select()
    if (data) setHabits(h => [...h, ...(data as Habit[])])
    showToast('Hábitos de exemplo adicionados!')
    setSaving(false)
  }

  const filtered  = filterArea === 'all' ? habits : habits.filter(h => h.area === filterArea)
  const activeCount = habits.filter(h => h.active).length
  const totalXP   = habits.filter(h => h.active).reduce((a, h) => a + h.xp_reward, 0)

  // Agrupar por área para view em grid
  const byArea = AREAS.map(([key, meta]) => ({
    key, meta,
    items: filtered.filter(h => h.area === key),
  })).filter(g => g.items.length > 0)

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)',
          borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 200, whiteSpace: 'nowrap',
        }}>✓ {toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Hábitos</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
            <span>{activeCount} activos</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: 'var(--gold)' }}>+{totalXP} XP/dia possível</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Toggle view */}
          <button onClick={() => setView(v => v === 'list' ? 'grid' : 'list')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {view === 'list'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            }
          </button>
          <button onClick={openNew} style={{
            background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
            borderRadius: 12, padding: '9px 16px', fontFamily: 'Syne, sans-serif',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>+ Novo</button>
        </div>
      </div>

      {/* Estado vazio */}
      {habits.length === 0 && (
        <div style={{ margin: '20px 20px 0', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 18, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🌱</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Sem hábitos ainda</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Começa com exemplos prontos ou cria os teus próprios.
          </p>
          <button onClick={addDefaults} disabled={saving} style={{
            width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
            borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', marginBottom: 10,
          }}>{saving ? 'A adicionar…' : 'Adicionar hábitos de exemplo'}</button>
          <button onClick={openNew} style={{
            width: '100%', background: 'transparent', color: 'var(--accent)',
            border: '0.5px solid rgba(127,119,221,.3)', borderRadius: 14, padding: 14,
            fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Criar personalizado</button>
        </div>
      )}

      {habits.length > 0 && (<>
        {/* Filtro por área */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[['all', 'Todos', '', 'var(--gold)'], ...AREAS.map(([k, m]) => [k, m.label, m.icon, m.color])].map(([key, label, icon, color]) => {
            const active = filterArea === key
            return (
              <button key={key} onClick={() => setFilterArea(key as HabitArea | 'all')}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
                  background: active ? color : 'var(--bg2)',
                  color: active ? (key === 'all' ? 'var(--bg0)' : '#0D0F14') : 'var(--text3)',
                  outline: active ? 'none' : '0.5px solid var(--border)',
                }}>
                {icon && <span style={{ fontSize: 13 }}>{icon}</span>}{label}
              </button>
            )
          })}
        </div>

        {/* Contagem filtrada */}
        <div style={{ padding: '10px 20px 14px', fontSize: 11, color: 'var(--text3)' }}>
          {filtered.length} hábito{filtered.length !== 1 ? 's' : ''}
          {filterArea !== 'all' && ` em ${AREA_META[filterArea]?.label}`}
        </div>

        {/* ── VISTA LISTA ── */}
        {view === 'list' && (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(h => {
              const area = AREA_META[h.area]
              return (
                <div key={h.id} style={{
                  background: 'var(--bg2)', border: '0.5px solid var(--border)',
                  borderRadius: 16, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: h.active ? 1 : 0.45, transition: 'opacity .2s',
                }}>
                  {/* Icon área */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    background: `${area.color}18`,
                  }}>{area.icon}</div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => openEdit(h)} >
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 5, cursor: 'pointer' }}>{h.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{area.label}</span>
                      {h.time_window && (
                        <span style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 6 }}>
                          {h.time_window}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                        +{h.xp_reward} XP
                      </span>
                    </div>
                  </div>

                  {/* Acções */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Switch */}
                    <button onClick={() => toggleActive(h)} style={{
                      width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer',
                      background: h.active ? 'var(--teal)' : 'var(--bg3)', position: 'relative', transition: 'background .2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 4, width: 16, height: 16, borderRadius: '50%',
                        background: 'white', transition: 'left .2s',
                        left: h.active ? 'calc(100% - 20px)' : '4px',
                      }} />
                    </button>
                    {/* Editar */}
                    <button onClick={() => openEdit(h)} style={{
                      width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)',
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {/* Apagar */}
                    <button onClick={() => remove(h.id)} style={{
                      width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)',
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── VISTA GRID (por área) ── */}
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
                  {items.map(h => (
                    <div key={h.id} onClick={() => openEdit(h)} style={{
                      background: 'var(--bg2)', border: `0.5px solid ${h.active ? `${meta.color}30` : 'var(--border)'}`,
                      borderRadius: 14, padding: '14px 14px 12px',
                      opacity: h.active ? 1 : 0.45, cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 8 }}>{meta.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', marginBottom: 4, lineHeight: 1.3 }}>{h.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {h.time_window
                          ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>{h.time_window}</span>
                          : <span />}
                        <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>+{h.xp_reward}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ── FORMULÁRIO MODAL ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end',
          background: 'rgba(0,0,0,.65)',
        }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{
            width: '100%', maxWidth: 448, margin: '0 auto',
            background: 'var(--bg1)', borderRadius: '20px 20px 0 0',
            borderTop: '0.5px solid var(--border)',
            display: 'flex', flexDirection: 'column', maxHeight: '90vh',
          }}>
            <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>
                {editHabit ? 'Editar hábito' : 'Novo hábito'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{
                width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Treino, Leitura, Idioma…" style={{ ...S, marginBottom: 16 }} />

            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Área da vida</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {AREAS.map(([key, meta]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, area: key }))} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif', textAlign: 'left', transition: 'all .15s',
                  background: form.area === key ? `${meta.color}18` : 'var(--bg2)',
                  color: form.area === key ? meta.color : 'var(--text2)',
                  outline: form.area === key ? `0.5px solid ${meta.color}` : '0.5px solid var(--border)',
                }}>
                  <span>{meta.icon}</span>{meta.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Melhor hora (opcional)</label>
            <input value={form.time_window} onChange={e => setForm(f => ({ ...f, time_window: e.target.value }))}
              placeholder="Ex: 07:00–08:00 ou Manhã" style={{ ...S, marginBottom: 16 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)' }}>XP por conclusão</label>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>
                {form.xp_reward} XP
              </span>
            </div>
            {/* Pills de XP fixos 5/8/10/15/20 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[5, 8, 10, 15, 20].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, xp_reward: v }))} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600, transition: 'all .15s',
                  background: form.xp_reward === v ? 'var(--gold)' : 'var(--bg2)',
                  color: form.xp_reward === v ? 'var(--bg0)' : 'var(--text3)',
                  outline: form.xp_reward === v ? 'none' : '0.5px solid var(--border)',
                }}>{v}</button>
              ))}
            </div>

            </div>
            <div style={{ padding: '12px 24px 48px', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)' }}>
              <button onClick={save} disabled={saving || !form.name.trim()} style={{
                width: '100%', background: form.name.trim() ? 'var(--gold)' : 'var(--bg3)',
                color: form.name.trim() ? 'var(--bg0)' : 'var(--text3)', border: 'none',
                borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700,
                fontSize: 14, cursor: form.name.trim() ? 'pointer' : 'not-allowed', transition: 'all .2s',
              }}>{saving ? 'A guardar…' : editHabit ? 'Guardar alterações' : 'Criar hábito'}</button>
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
