'use client'
import { useEffect, useState } from 'react'
import { format, addDays } from 'date-fns'
import Nav from '@/components/Nav'
import ObjetivosHub from '@/components/objetivos/ObjetivosHub'
import { supabase, getGoals90, saveGoal90, deleteGoal90, getMilestones, toggleMilestone } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { Goal90, HabitArea } from '@/types'

type Milestone = { id: string; goal_id: string; user_id: string; title: string; done: boolean; due_date: string | null }

const FONT = 'Inter, sans-serif'

const CATEGORIES = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.10)',
  borderRadius: 13, padding: '12px 14px', color: '#fff',
  fontFamily: FONT, fontSize: 14, outline: 'none',
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'rgba(var(--ink-rgb),0.3)', display: 'block', marginBottom: 8, fontFamily: FONT,
}

function daysLeftOf(endDate: string): number {
  const end = new Date(endDate + 'T12:00:00')
  return Math.max(0, Math.round((end.getTime() - Date.now()) / 86400000))
}

export default function ObjetivosPage() {
  const [userId,    setUserId]    = useState<string | null>(null)
  const [goals,     setGoals]     = useState<Goal90[]>([])
  const [milestones,setMilestones]= useState<Record<string, Milestone[]>>({})
  const [openGoalId,setOpenGoalId]= useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Goal90 | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editGoal,  setEditGoal]  = useState<Goal90 | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')
  const [newMs,     setNewMs]     = useState('')

  // Form state
  const [fTitle,    setFTitle]    = useState('')
  const [fArea,     setFArea]     = useState<HabitArea>('corpo')
  const [fProgress, setFProgress] = useState(0)
  const [fStart,    setFStart]    = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fEnd,      setFEnd]      = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      await loadGoals(user.id)
    })
  }, [])

  async function loadGoals(uid: string) {
    const data = await getGoals90(uid) as Goal90[]
    setGoals(data)
    // Carregar marcos para cada objectivo
    const ms: Record<string, Milestone[]> = {}
    await Promise.all(data.map(async g => {
      ms[g.id] = (await getMilestones(g.id)) as Milestone[]
    }))
    setMilestones(ms)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2400) }

  function openNew() {
    setEditGoal(null)
    setFTitle(''); setFArea('corpo'); setFProgress(0)
    setFStart(format(new Date(), 'yyyy-MM-dd'))
    setFEnd(format(addDays(new Date(), 90), 'yyyy-MM-dd'))
    setShowForm(true)
  }

  // Adiciona um objetivo-modelo direto da lista de sugestões (janela padrão de 90 dias).
  async function addSuggestion(title: string, area: HabitArea) {
    if (!userId) return
    await saveGoal90({
      user_id: userId,
      title,
      area,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      progress: 0,
      status: 'active',
    })
    await loadGoals(userId)
    showToast('Objetivo adicionado!')
  }

  function openEdit(g: Goal90) {
    setEditGoal(g)
    setFTitle(g.title); setFArea(g.area as HabitArea)
    setFProgress(g.progress); setFStart(g.start_date); setFEnd(g.end_date)
    setShowForm(true)
  }

  async function save() {
    if (!userId || !fTitle.trim()) return
    setSaving(true)
    const payload = {
      user_id: userId, title: fTitle.trim(), area: fArea,
      start_date: fStart, end_date: fEnd,
      progress: fProgress, status: 'active',
      ...(editGoal ? { id: editGoal.id } : {}),
    }
    await saveGoal90(payload)
    await loadGoals(userId)
    setShowForm(false)
    showToast(editGoal ? 'Objectivo actualizado!' : 'Objectivo criado!')
    setSaving(false)
  }

  async function remove(id: string) {
    if (!userId) return
    await deleteGoal90(id)
    setGoals(g => g.filter(x => x.id !== id))
    setConfirmDelete(null)
    setOpenGoalId(null)
    showToast('Objectivo removido.')
  }

  async function updateProgress(goal: Goal90, pct: number) {
    if (!userId) return
    await saveGoal90({ id: goal.id, progress: pct, status: pct >= 100 ? 'done' : 'active' })
    setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, progress: pct } : g))
  }

  async function addMilestone(goalId: string) {
    if (!userId || !newMs.trim()) return
    const { data } = await supabase.from('goal_milestones')
      .insert({ goal_id: goalId, user_id: userId, title: newMs.trim() })
      .select().single()
    if (data) {
      setMilestones(m => ({ ...m, [goalId]: [...(m[goalId] ?? []), data as Milestone] }))
      setNewMs('')
    }
  }

  async function tickMilestone(goalId: string, ms: Milestone) {
    await toggleMilestone(ms.id, !ms.done)
    setMilestones(m => ({
      ...m,
      [goalId]: m[goalId].map(x => x.id === ms.id ? { ...x, done: !x.done } : x),
    }))
    // Auto-update progress based on milestones
    const list = milestones[goalId] ?? []
    const done  = list.filter(x => x.id === ms.id ? !ms.done : x.done).length
    const pct   = Math.round(done / list.length * 100)
    const goal  = goals.find(g => g.id === goalId)
    if (goal) updateProgress(goal, pct)
  }

  const openGoal = openGoalId ? goals.find(g => g.id === openGoalId) ?? null : null

  const toastEl = toast && (
    <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-pop)', border: '1px solid rgba(0,200,150,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontFamily: FONT, color: '#00C896', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10000, whiteSpace: 'nowrap' }}>
      ✓ {toast}
    </div>
  )

  // ── Modal de criação/edição ───────────────────────────────────────────────
  const formModal = showForm && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && setShowForm(false)}>
      <div style={{
        width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--surface-card)',
        borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(var(--ink-rgb),0.12)',
        display: 'flex', flexDirection: 'column', maxHeight: 'min(86dvh, 720px)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(var(--ink-rgb),0.18)', margin: '10px auto 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.3px' }}>
            {editGoal ? 'Editar objectivo' : 'Novo objectivo'}
          </h2>
          <button onClick={() => setShowForm(false)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(var(--ink-rgb),0.06)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(var(--ink-rgb),0.6)' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          <label style={fieldLabel}>Objectivo</label>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)}
            placeholder="Ex: Correr 5km sem parar" style={{ ...inp, marginBottom: 16 }} />

          <label style={fieldLabel}>Área</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map(([key, meta]) => (
              <button key={key} onClick={() => setFArea(key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 13, cursor: 'pointer', textAlign: 'left',
                background: fArea === key ? `${meta.color}18` : 'rgba(var(--ink-rgb),0.03)',
                border: fArea === key ? `1px solid ${meta.color}77` : '1px solid rgba(var(--ink-rgb),0.10)',
                color: fArea === key ? meta.color : 'rgba(var(--ink-rgb),0.55)',
                fontSize: 13, fontWeight: 600, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 15 }}>{meta.icon}</span>{meta.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={fieldLabel}>Início</label>
              <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={fieldLabel}>Fim</label>
              <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} style={inp} />
            </div>
          </div>

        </div>

        <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: 'var(--surface-card)', borderTop: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
          <button onClick={save} disabled={saving || !fTitle.trim()} style={{
            width: '100%', background: fTitle.trim() ? 'linear-gradient(135deg, #F5C842, #E0A82A)' : 'rgba(var(--ink-rgb),0.06)',
            color: fTitle.trim() ? '#1A1200' : 'rgba(var(--ink-rgb),0.35)', border: 'none',
            borderRadius: 15, padding: 15, fontFamily: FONT, fontWeight: 800,
            fontSize: 15, cursor: fTitle.trim() ? 'pointer' : 'not-allowed',
          }}>{saving ? 'A guardar…' : editGoal ? 'Guardar alterações' : 'Criar objectivo'}</button>
        </div>
      </div>
    </div>
  )

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: 'var(--surface-page)' }}>
      {toastEl}
      <ObjetivosHub
        goals={goals}
        milestones={milestones}
        onOpenGoal={setOpenGoalId}
        onAdd={openNew}
        onAddSuggestion={addSuggestion}
      />

      {/* ── Bottom sheet: detalhe do objetivo ── */}
      {openGoal && !showForm && (() => {
        const area   = AREA_META[openGoal.area as HabitArea]
        const color  = area?.color ?? '#9D5CF5'
        const msList = milestones[openGoal.id] ?? []
        const msDone = msList.filter(m => m.done).length
        const dl     = daysLeftOf(openGoal.end_date)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
            onClick={e => e.target === e.currentTarget && setOpenGoalId(null)}>
            <div style={{
              width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--surface-card)',
              borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(var(--ink-rgb),0.12)',
              display: 'flex', flexDirection: 'column', maxHeight: 'min(86dvh, 720px)',
              fontFamily: FONT, boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(var(--ink-rgb),0.18)', margin: '10px auto 0', flexShrink: 0 }} />

              {/* Header fixo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 12px', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${color}1F`, fontSize: 18,
                }}>
                  {area?.icon ?? '🎯'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                    {openGoal.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(var(--ink-rgb),0.4)', marginTop: 2 }}>
                    {area?.label ?? openGoal.area} · {dl > 0 ? `${dl} dias restantes` : 'Terminou'}
                  </div>
                </div>
                <button onClick={() => setOpenGoalId(null)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(var(--ink-rgb),0.06)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(var(--ink-rgb),0.6)', flexShrink: 0 }}>✕</button>
              </div>

              {/* Corpo scrollável */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
                {/* Período */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(var(--ink-rgb),0.35)' }}>
                  <span>Início · {format(new Date(openGoal.start_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  <span>Fim · {format(new Date(openGoal.end_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                </div>

                {/* Marcos */}
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(var(--ink-rgb),0.3)', margin: '20px 0 10px' }}>
                  Marcos {msList.length > 0 && <span style={{ color: 'rgba(var(--ink-rgb),0.45)' }}>· {msDone}/{msList.length}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msList.map(m => (
                    <button
                      key={m.id}
                      onClick={() => tickMilestone(openGoal.id, m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                        background: m.done ? 'rgba(0,200,150,0.05)' : 'rgba(var(--ink-rgb),0.03)',
                        border: `1px solid ${m.done ? 'rgba(0,200,150,0.15)' : 'rgba(var(--ink-rgb),0.08)'}`,
                        borderRadius: 13, padding: '11px 13px', cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${m.done ? '#00C896' : 'rgba(var(--ink-rgb),0.2)'}`,
                        background: m.done ? '#00C896' : 'transparent',
                        color: m.done ? '#001A10' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                      }}>✓</span>
                      <span style={{
                        flex: 1, fontSize: 13.5, fontWeight: 600,
                        color: m.done ? 'rgba(var(--ink-rgb),0.45)' : 'rgba(var(--ink-rgb),0.85)',
                        textDecoration: m.done ? 'line-through' : 'none',
                        textDecorationColor: 'rgba(var(--ink-rgb),0.2)',
                        overflowWrap: 'anywhere',
                      }}>{m.title}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: msList.length > 0 ? 10 : 0 }}>
                  <input
                    value={newMs} onChange={e => setNewMs(e.target.value)}
                    placeholder="Novo marco…"
                    onKeyDown={e => e.key === 'Enter' && addMilestone(openGoal.id)}
                    style={{ ...inp, flex: 1, padding: '10px 13px', fontSize: 13 }}
                  />
                  <button onClick={() => addMilestone(openGoal.id)} disabled={!newMs.trim()} style={{
                    padding: '10px 14px', borderRadius: 13,
                    background: newMs.trim() ? 'rgba(245,200,66,0.12)' : 'rgba(var(--ink-rgb),0.04)',
                    border: `1px solid ${newMs.trim() ? 'rgba(245,200,66,0.4)' : 'rgba(var(--ink-rgb),0.08)'}`,
                    color: newMs.trim() ? '#F5C842' : 'rgba(var(--ink-rgb),0.3)',
                    fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: newMs.trim() ? 'pointer' : 'default',
                  }}>+ Adicionar</button>
                </div>

                {/* Apagar */}
                <button
                  onClick={() => setConfirmDelete(openGoal)}
                  style={{
                    marginTop: 20, width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    border: '1px solid rgba(226,75,74,0.25)', borderRadius: 13, padding: '13px 14px',
                    background: 'transparent', color: '#E24B4A', fontSize: 13.5, fontWeight: 700,
                    fontFamily: FONT, cursor: 'pointer',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                  Apagar objetivo
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'rgba(226,75,74,0.6)' }}>pede confirmação</span>
                </button>
              </div>

              {/* Footer fixo */}
              <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: 'var(--surface-card)', borderTop: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
                <button
                  onClick={() => { setOpenGoalId(null); openEdit(openGoal) }}
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #F5C842, #E0A82A)', color: '#1A1200',
                    border: 'none', borderRadius: 15, padding: 15, fontFamily: FONT, fontWeight: 800,
                    fontSize: 15, cursor: 'pointer',
                  }}
                >
                  Editar objetivo
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Confirmação de apagar ── */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}
        >
          <div style={{ width: '100%', maxWidth: 340, background: 'var(--surface-pop)', border: '1px solid rgba(var(--ink-rgb),0.12)', borderRadius: 20, padding: '22px 20px', fontFamily: FONT }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Apagar objetivo?</div>
            <p style={{ fontSize: 13, color: 'rgba(var(--ink-rgb),0.5)', lineHeight: 1.5, marginBottom: 18, overflowWrap: 'anywhere' }}>
              “{confirmDelete.title}” e os seus marcos vão ser removidos. Esta ação é irreversível.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(var(--ink-rgb),0.12)', background: 'rgba(var(--ink-rgb),0.04)', color: 'rgba(var(--ink-rgb),0.7)', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => remove(confirmDelete.id)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {formModal}
      <Nav />
    </main>
  )
}
