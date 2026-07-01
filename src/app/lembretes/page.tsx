'use client'
// src/app/lembretes/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { requireUser, getReminders, saveReminder, deleteReminder, toggleReminder } from '@/lib/supabase'

const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const TYPES = [
  { value: 'checkin_manha', label: '🌅 Check-in Manhã' },
  { value: 'checkin_tarde', label: '☀️ Check-in Tarde' },
  { value: 'checkin_noite', label: '🌙 Check-in Noite' },
  { value: 'habito',        label: '✅ Hábito' },
  { value: 'custom',        label: '🔔 Personalizado' },
]

type Reminder = {
  id: string
  user_id: string
  title: string
  description: string | null
  time: string
  days: number[]
  active: boolean
  type: string
}

type FormState = {
  id?: string
  title: string
  description: string
  time: string
  days: number[]
  type: string
}

const EMPTY: FormState = { title: '', description: '', time: '08:00', days: [1,2,3,4,5], type: 'custom' }

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}

export default function LembretesPage() {
  const [userId,    setUserId]    = useState<string | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<FormState>(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')

  useEffect(() => {
    requireUser().then(async (user) => {
      if (!user) return
      setUserId(user.id)
      const data = await getReminders(user.id)
      setReminders(data as Reminder[])
    })
  }, [])

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 2200)
  }

  function toggleDay(d: number) {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d],
    }))
  }

  async function save() {
    if (!userId || !form.title.trim()) return
    setSaving(true)
    await saveReminder({ ...form, user_id: userId })
    const data = await getReminders(userId)
    setReminders(data as Reminder[])
    setShowForm(false)
    setForm(EMPTY)
    showToast(form.id ? 'Lembrete atualizado!' : 'Lembrete criado!')
    setSaving(false)
  }

  async function remove(id: string) {
    await deleteReminder(id)
    setReminders(r => r.filter(x => x.id !== id))
    showToast('Lembrete removido.')
  }

  async function toggle(id: string, active: boolean) {
    await toggleReminder(id, !active)
    setReminders(r => r.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  function edit(r: Reminder) {
    setForm({ id: r.id, title: r.title, description: r.description ?? '', time: r.time, days: r.days, type: r.type })
    setShowForm(true)
  }

  function addDefault() {
    if (!userId) return
    const defaults: FormState[] = [
      { title: 'Check-in da Manhã', description: '', time: '08:00', days: [0,1,2,3,4,5,6], type: 'checkin_manha' },
      { title: 'Check-in da Tarde', description: '', time: '14:00', days: [0,1,2,3,4,5,6], type: 'checkin_tarde' },
      { title: 'Check-in da Noite', description: '', time: '21:00', days: [0,1,2,3,4,5,6], type: 'checkin_noite' },
    ]
    defaults.forEach(d => saveReminder({ ...d, user_id: userId }))
    setTimeout(async () => {
      const data = await getReminders(userId)
      setReminders(data as Reminder[])
      showToast('Lembretes padrão adicionados!')
    }, 500)
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)',
          borderRadius: 12, padding: '10px 16px', fontSize: 13, color: 'var(--teal)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 200, whiteSpace: 'nowrap',
        }}>✓ {toast}</div>
      )}

      {/* Header */}
      <div style={{ padding: '28px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Lembretes</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{reminders.filter(r => r.active).length} activos</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowForm(true) }} style={{
          background: 'var(--gold)', color: 'var(--on-bright)', border: 'none', borderRadius: 12,
          padding: '10px 18px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Novo</button>
      </div>

      {/* Estado vazio */}
      {reminders.length === 0 && (
        <div style={{ margin: '0 20px', padding: 24, borderRadius: 16, background: 'var(--bg2)', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Sem lembretes</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>Adiciona lembretes para os check-ins ou cria os teus.</p>
          <button onClick={addDefault} style={{
            width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
            borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10,
          }}>Adicionar lembretes padrão</button>
          <button onClick={() => setShowForm(true)} style={{
            width: '100%', background: 'transparent', color: 'var(--accent)', border: '0.5px solid rgba(127,119,221,.28)',
            borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Criar personalizado</button>
        </div>
      )}

      {/* Lista */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reminders.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg2)', border: '0.5px solid var(--border)',
            borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            opacity: r.active ? 1 : 0.5,
          }}>
            {/* Icon tipo */}
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: r.active ? 'rgba(232,168,56,.12)' : 'var(--bg3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {TYPES.find(t => t.value === r.type)?.label.split(' ')[0] ?? '🔔'}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text1)', marginBottom: 3 }}>{r.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                  {r.time.slice(0,5)}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {DAYS.map((d, i) => (
                    <span key={i} style={{
                      width: 18, height: 18, borderRadius: 5, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: r.days.includes(i) ? 'var(--accent)' : 'var(--bg3)',
                      color: r.days.includes(i) ? 'white' : 'var(--text3)',
                    }}>{d[0]}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button onClick={() => edit(r)} style={{
                width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button onClick={() => toggle(r.id, r.active)} style={{
                width: 40, height: 22, borderRadius: 100, border: 'none', cursor: 'pointer',
                background: r.active ? 'var(--teal)' : 'var(--bg3)', position: 'relative', transition: 'all .2s',
              }}>
                <div style={{
                  position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'all .2s',
                  left: r.active ? 'calc(100% - 19px)' : 3,
                }} />
              </button>
              <button onClick={() => remove(r.id)} style={{
                width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end',
        }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{
            width: '100%', maxWidth: 448, margin: '0 auto',
            background: 'var(--bg1)', borderRadius: '20px 20px 0 0',
            borderTop: '0.5px solid var(--border)',
            padding: '24px 24px calc(24px + env(safe-area-inset-bottom))',
            maxHeight: 'min(86dvh, 720px)', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>
                {form.id ? 'Editar' : 'Novo'} lembrete
              </h2>
              <button onClick={() => setShowForm(false)} style={{
                width: 32, height: 32, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Título</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Beber água, Treino..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Hora</label>
                <input style={inputStyle} type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Tipo</label>
                <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Dias da semana</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
                    background: form.days.includes(i) ? 'var(--accent)' : 'var(--bg3)',
                    color: form.days.includes(i) ? 'white' : 'var(--text3)',
                  }}>{d[0]}</button>
                ))}
              </div>
            </div>

            <button onClick={save} disabled={saving || !form.title.trim()} style={{
              width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
              borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', opacity: form.title.trim() ? 1 : 0.5,
            }}>
              {saving ? 'A guardar…' : 'Guardar lembrete'}
            </button>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
