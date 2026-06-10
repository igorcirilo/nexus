'use client'
import { useEffect, useState } from 'react'
import { format, differenceInDays, addDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import ObjetivosHub from '@/components/objetivos/ObjetivosHub'
import { supabase, getGoals90, saveGoal90, deleteGoal90, getMilestones, toggleMilestone } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { Goal90, HabitArea } from '@/types'

type AppTab   = 'resumo' | 'detalhes'
type Milestone = { id: string; goal_id: string; user_id: string; title: string; done: boolean; due_date: string | null }

const CATEGORIES = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}

export default function ObjetivosPage() {
  const [tab,       setTab]       = useState<AppTab>('resumo')
  const [userId,    setUserId]    = useState<string | null>(null)
  const [goals,     setGoals]     = useState<Goal90[]>([])
  const [milestones,setMilestones]= useState<Record<string, Milestone[]>>({})
  const [expanded,  setExpanded]  = useState<string | null>(null)
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
    if (!editGoal) setTab('resumo')
  }

  async function remove(id: string) {
    if (!userId) return
    await deleteGoal90(id)
    setGoals(g => g.filter(x => x.id !== id))
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

  const today = new Date()

  // Toast partilhado entre o hub e a vista de detalhes
  const toastEl = toast && (
    <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10000, whiteSpace: 'nowrap' }}>
      ✓ {toast}
    </div>
  )

  // ── Modal de criação/edição (acionável no hub e nos detalhes) ────────────
  const formModal = showForm && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && setShowForm(false)}>
      <div style={{
        width: '100%', maxWidth: 448, margin: '0 auto', background: '#0D0E20',
        borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', flexDirection: 'column', maxHeight: 'min(86dvh, 720px)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '10px auto 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.3px' }}>
            {editGoal ? 'Editar objectivo' : 'Novo objectivo'}
          </h2>
          <button onClick={() => setShowForm(false)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Objectivo</label>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)}
            placeholder="Ex: Correr 5km sem parar" style={{ ...inp, marginBottom: 16, fontFamily: 'Inter, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 13, color: '#fff' }} />

          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Área</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map(([key, meta]) => (
              <button key={key} onClick={() => setFArea(key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 13, cursor: 'pointer', textAlign: 'left',
                background: fArea === key ? `${meta.color}18` : 'rgba(255,255,255,0.03)',
                border: fArea === key ? `1px solid ${meta.color}77` : '1px solid rgba(255,255,255,0.10)',
                color: fArea === key ? meta.color : 'rgba(255,255,255,0.55)',
                fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}>
                <span style={{ fontSize: 15 }}>{meta.icon}</span>{meta.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Início</label>
              <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={{ ...inp, fontFamily: 'Inter, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 13, color: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Fim</label>
              <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} style={{ ...inp, fontFamily: 'Inter, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 13, color: '#fff' }} />
            </div>
          </div>

          {editGoal && (
            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Progresso actual: {fProgress}%</label>
              <input type="range" min={0} max={100} step={5} value={fProgress} onChange={e => setFProgress(+e.target.value)}
                style={{ width: '100%', accentColor: '#F5C842' }} />
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: '#0D0E20', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button onClick={save} disabled={saving || !fTitle.trim()} style={{
            width: '100%', background: fTitle.trim() ? 'linear-gradient(135deg, #F5C842, #E0A82A)' : 'rgba(255,255,255,0.06)',
            color: fTitle.trim() ? '#1A1200' : 'rgba(255,255,255,0.35)', border: 'none',
            borderRadius: 15, padding: 15, fontFamily: 'Inter, sans-serif', fontWeight: 800,
            fontSize: 15, cursor: fTitle.trim() ? 'pointer' : 'not-allowed',
          }}>{saving ? 'A guardar…' : editGoal ? 'Guardar alterações' : 'Criar objectivo'}</button>
        </div>
      </div>
    </div>
  )

  // ── Hub (tab resumo) ──────────────────────────────────────────────────────
  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: '#07070F' }}>
        {toastEl}
        <ObjetivosHub
          goals={goals}
          milestones={milestones}
          onDetails={() => setTab('detalhes')}
          onAdd={openNew}
        />
        {formModal}
        <Nav />
      </main>
    )
  }

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh' }}>

      {toastEl}

      {/* Header */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button onClick={() => setTab('resumo')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '4px 0' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Resumo
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Objectivos</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              {goals.length} activo{goals.length !== 1 ? 's' : ''} · plano de 90 dias
            </p>
          </div>
          <button onClick={openNew} style={{ background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: '9px 16px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Novo
          </button>
        </div>
      </div>

      {/* Empty */}
      {goals.length === 0 && (
        <div style={{ margin: '20px', padding: 28, borderRadius: 18, background: 'var(--bg2)', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Sem objectivos ainda</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Define o que queres alcançar nos próximos 90 dias. Um objectivo por área da vida.
          </p>
          <button onClick={openNew} style={{ width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Criar primeiro objectivo
          </button>
        </div>
      )}

      {/* Goals list */}
      <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map(g => {
          const area      = AREA_META[g.area as HabitArea]
          const start     = new Date(g.start_date + 'T12:00:00')
          const end       = new Date(g.end_date   + 'T12:00:00')
          const total     = differenceInDays(end, start)
          const elapsed   = Math.min(total, Math.max(0, differenceInDays(today, start)))
          const timePct   = Math.round(elapsed / total * 100)
          const daysLeft  = Math.max(0, differenceInDays(end, today))
          const isExpanded = expanded === g.id
          const msList    = milestones[g.id] ?? []
          const msDone    = msList.filter(m => m.done).length

          return (
            <div key={g.id} style={{ background: 'var(--bg2)', border: `0.5px solid ${area?.color}30`, borderRadius: 18, overflow: 'hidden' }}>

              {/* Card header */}
              <div style={{ padding: '16px 16px 14px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : g.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: `${area?.color}18` }}>
                    {area?.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)', marginBottom: 3, lineHeight: 1.3 }}>{g.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: area?.color }}>{area?.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
                      <span style={{ fontSize: 11, color: daysLeft <= 7 ? '#E24B4A' : 'var(--text3)' }}>
                        {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Terminou'}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: g.progress >= 100 ? 'var(--teal)' : 'var(--text1)', lineHeight: 1 }}>
                      {g.progress}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>concluído</div>
                  </div>
                </div>

                {/* Dual progress bar: tempo + progresso */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                    <span>Progresso</span><span>Tempo decorrido</span>
                  </div>
                  {/* Progresso real */}
                  <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 7, marginBottom: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${g.progress}%`, background: area?.color, borderRadius: 100, transition: 'width .5s' }} />
                  </div>
                  {/* Tempo */}
                  <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${timePct}%`, background: 'rgba(255,255,255,.15)', borderRadius: 100 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                    <span>{format(start, 'd MMM', { locale: pt })}</span>
                    <span>{format(end, 'd MMM yyyy', { locale: pt })}</span>
                  </div>
                </div>

                {/* Marcos mini */}
                {msList.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {msDone}/{msList.length} marcos ·{' '}
                    <span style={{ color: isExpanded ? 'var(--teal)' : 'var(--text3)' }}>
                      {isExpanded ? 'fechar ▲' : 'ver detalhes ▼'}
                    </span>
                  </div>
                )}
                {msList.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {isExpanded ? 'fechar ▲' : 'ver detalhes ▼'}
                  </div>
                )}
              </div>

              {/* Expanded section */}
              {isExpanded && (
                <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 16px' }}>

                  {/* Ajustar progresso */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ajustar progresso manualmente</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: area?.color }}>{g.progress}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={g.progress}
                      onChange={e => updateProgress(g, +e.target.value)}
                      style={{ width: '100%', accentColor: area?.color }} />
                  </div>

                  {/* Marcos */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Marcos de progresso</div>
                    {msList.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}
                        onClick={() => tickMilestone(g.id, m)}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                          background: m.done ? 'var(--teal)' : 'var(--bg3)',
                          border: m.done ? 'none' : '1.5px solid var(--text3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {m.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="var(--bg0)" strokeWidth="2.5"><polyline points="1,4 4,7 9,1"/></svg>}
                        </div>
                        <span style={{ fontSize: 13, color: m.done ? 'var(--text3)' : 'var(--text1)', textDecoration: m.done ? 'line-through' : 'none', cursor: 'pointer' }}>
                          {m.title}
                        </span>
                      </div>
                    ))}

                    {/* Adicionar marco */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input
                        value={newMs} onChange={e => setNewMs(e.target.value)}
                        placeholder="Novo marco…"
                        onKeyDown={e => e.key === 'Enter' && addMilestone(g.id)}
                        style={{ ...inp, flex: 1, padding: '9px 12px', fontSize: 13 }}
                      />
                      <button onClick={() => addMilestone(g.id)} style={{
                        padding: '9px 14px', borderRadius: 10, background: 'var(--bg3)',
                        border: '0.5px solid var(--border)', color: 'var(--text2)',
                        fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}>+ Adicionar</button>
                    </div>
                  </div>

                  {/* Acções */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(g)} style={{
                      flex: 1, padding: '9px', borderRadius: 10, background: 'var(--bg3)',
                      border: '0.5px solid var(--border)', color: 'var(--text2)',
                      fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}>✏️ Editar</button>
                    <button onClick={() => remove(g.id)} style={{
                      padding: '9px 14px', borderRadius: 10, background: 'transparent',
                      border: '0.5px solid rgba(226,75,74,.3)', color: '#E24B4A',
                      fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}>🗑 Remover</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {formModal}

      <Nav />
    </main>
  )
}
