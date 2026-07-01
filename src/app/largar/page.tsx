'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { requireUser } from '@/lib/supabase'
import {
  getQuitHabits,
  createQuitHabit,
  registerRelapse,
  deleteQuitHabit,
  daysClean,
  nextMilestone,
} from '@/lib/quit-habits'
import { AREA_META } from '@/types'
import type { QuitHabit, HabitArea } from '@/types'

const FONT = 'Inter, sans-serif'
const AREAS = Object.entries(AREA_META) as [HabitArea, { label: string; icon: string; color: string }][]

const SUGGESTIONS = ['Redes sociais em excesso', 'Procrastinar', 'Açúcar', 'Fumar', 'Roer as unhas', 'Fast food', 'Álcool', 'Compras por impulso']

export default function LargarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [habits, setHabits] = useState<QuitHabit[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [area, setArea] = useState<HabitArea | null>(null)
  const [motivation, setMotivation] = useState('')
  const [saving, setSaving] = useState(false)

  const [relapseFor, setRelapseFor] = useState<QuitHabit | null>(null)
  const [relapseNote, setRelapseNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<QuitHabit | null>(null)

  useEffect(() => {
    requireUser().then(async (user) => {
      if (!user) return
      setUserId(user.id)
      await reload(user.id)
      setLoading(false)
    })
  }, [])

  async function reload(uid: string) {
    setHabits(await getQuitHabits(uid))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function openNew() {
    setName('')
    setArea(null)
    setMotivation('')
    setShowForm(true)
  }

  async function save() {
    if (!userId || !name.trim()) return
    setSaving(true)
    const { error } = await createQuitHabit({ user_id: userId, name, area, motivation })
    if (error) {
      showToast('Erro ao guardar. A tabela já foi criada na BD?')
    } else {
      await reload(userId)
      showToast('A contar a partir de hoje. Força! 💪')
      setShowForm(false)
    }
    setSaving(false)
  }

  async function doRelapse() {
    if (!userId || !relapseFor) return
    await registerRelapse(relapseFor, relapseNote)
    setRelapseFor(null)
    setRelapseNote('')
    await reload(userId)
    showToast('Registado. Amanhã é um novo dia. 🌅')
  }

  async function doDelete() {
    if (!userId || !confirmDelete) return
    await deleteQuitHabit(confirmDelete.id)
    setConfirmDelete(null)
    await reload(userId)
    showToast('Removido.')
  }

  const active = useMemo(() => habits.filter((h) => h.active), [habits])

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: 'var(--surface-page)' }}>
      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}

      <div style={{ fontFamily: FONT, padding: '0 22px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 6px' }}>
          <Link href="/habitos" aria-label="Voltar" style={backBtn}>‹</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Largar</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>
              {active.length > 0 ? `${active.length} ${active.length === 1 ? 'hábito' : 'hábitos'} em curso` : 'Conta os dias sem recair'}
            </div>
          </div>
          <button onClick={openNew} aria-label="Novo" style={plusBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>A carregar…</div>
        ) : active.length === 0 ? (
          <div style={{ background: 'var(--surface-2)', border: '1px dashed rgba(var(--ink-rgb),0.15)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginTop: 14 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🚭</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Sem hábitos a largar</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', margin: '6px 0 16px', lineHeight: 1.5 }}>
              Escolhe um mau hábito para deixar. Vamos contar cada dia sem recair.
            </div>
            <button onClick={openNew} style={primaryBtn}>Começar agora</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {active.map((h) => (
              <QuitCard
                key={h.id}
                habit={h}
                onRelapse={() => setRelapseFor(h)}
                onDelete={() => setConfirmDelete(h)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sheet: novo hábito ── */}
      {showForm && (
        <div style={overlay} onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div style={sheet}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)' }}>
              <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>Largar um hábito</h2>
              <button onClick={() => setShowForm(false)} aria-label="Fechar" style={closeBtn}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 20px 16px' }}>
              <label style={fieldLabel}>Qual hábito queres largar?</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: redes sociais, açúcar…" style={input} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setName(s)} style={suggChip}>{s}</button>
                ))}
              </div>

              <label style={fieldLabel}>Área (opcional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {AREAS.map(([key, meta]) => {
                  const on = area === key
                  return (
                    <button
                      key={key}
                      onClick={() => setArea(on ? null : key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 13,
                        cursor: 'pointer', fontSize: 13, fontFamily: FONT, fontWeight: 600, textAlign: 'left',
                        background: on ? `${meta.color}18` : 'rgba(var(--ink-rgb),0.03)',
                        color: on ? meta.color : 'var(--text2)',
                        border: on ? `1px solid ${meta.color}77` : '1px solid rgba(var(--ink-rgb),0.10)',
                      }}
                    >
                      <span>{meta.icon}</span>{meta.label}
                    </button>
                  )
                })}
              </div>

              <label style={fieldLabel}>A tua motivação (opcional)</label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Porque é que isto importa para ti?"
                rows={3}
                style={{ ...input, resize: 'none' }}
              />
            </div>
            <div style={footer}>
              <button onClick={save} disabled={saving || !name.trim()} style={{ ...primaryBtn, width: '100%', opacity: name.trim() ? 1 : 0.5 }}>
                {saving ? 'A guardar…' : 'Começar a contar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: recaída ── */}
      {relapseFor && (
        <div style={centerOverlay} onClick={(e) => e.target === e.currentTarget && setRelapseFor(null)}>
          <div style={dialog}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Registar recaída?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 6 }}>
              A sequência de <strong>{daysClean(relapseFor.quit_date)} dia(s)</strong> em “{relapseFor.name}” será guardada como histórico e a contagem reinicia. Sem culpa — recomeçar faz parte.
            </p>
            <textarea
              value={relapseNote}
              onChange={(e) => setRelapseNote(e.target.value)}
              placeholder="O que aconteceu? (opcional)"
              rows={2}
              style={{ ...input, resize: 'none', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRelapseFor(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={doRelapse} style={{ ...primaryBtn, flex: 1, background: '#E2884B' }}>Recaí, reiniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: apagar ── */}
      {confirmDelete && (
        <div style={centerOverlay} onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div style={dialog}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Apagar?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18, overflowWrap: 'anywhere' }}>
              “{confirmDelete.name}” e o seu histórico de recaídas serão removidos. Irreversível.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={doDelete} style={{ ...primaryBtn, flex: 1, background: '#E24B4A' }}>Apagar</button>
            </div>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}

// ── card ────────────────────────────────────────────────────────────
function QuitCard({ habit, onRelapse, onDelete }: { habit: QuitHabit; onRelapse: () => void; onDelete: () => void }) {
  const days = daysClean(habit.quit_date)
  const next = nextMilestone(days)
  const meta = habit.area ? AREA_META[habit.area] : null
  const accent = meta?.color ?? '#1ECBB4'

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 18, padding: '18px 18px 16px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 7 }}>
            {meta && <span style={{ fontSize: 14 }}>{meta.icon}</span>}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.name}</span>
          </div>
          {habit.motivation && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>“{habit.motivation}”</div>
          )}
        </div>
        <button onClick={onDelete} aria-label="Apagar" style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(var(--ink-rgb),0.08)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto' }}>
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>

      {/* Contador grande */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 4px' }}>
        <span style={{ fontSize: 44, fontWeight: 800, color: accent, letterSpacing: '-1px', lineHeight: 1 }}>{days}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{days === 1 ? 'dia limpo' : 'dias limpo'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>
        <span>🏆 Recorde: <strong style={{ color: 'var(--text2)' }}>{Math.max(habit.best_streak, days)} d</strong></span>
        {next != null && <span>🎯 Próximo marco: <strong style={{ color: 'var(--text2)' }}>{next} d</strong></span>}
      </div>

      {/* Barra até ao próximo marco */}
      {next != null && (
        <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.round((days / next) * 100))}%`, background: accent, borderRadius: 10 }} />
        </div>
      )}

      <button onClick={onRelapse} style={relapseBtn}>Recaí hoje</button>
    </div>
  )
}

// ── estilos ─────────────────────────────────────────────────────────
const backBtn: CSSProperties = { width: 36, height: 36, borderRadius: 11, background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text1)', textDecoration: 'none', fontSize: 22, fontWeight: 700, flexShrink: 0 }
const plusBtn: CSSProperties = { width: 38, height: 38, borderRadius: 12, background: 'rgba(245,200,66,0.14)', border: '1px solid rgba(245,200,66,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5C842', cursor: 'pointer', flexShrink: 0 }
const primaryBtn: CSSProperties = { background: 'linear-gradient(135deg, #F5C842, #E0A82A)', color: '#1A1200', border: 'none', borderRadius: 14, padding: '13px 18px', fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const ghostBtn: CSSProperties = { flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(var(--ink-rgb),0.12)', background: 'var(--surface-2)', color: 'var(--text1)', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const relapseBtn: CSSProperties = { width: '100%', padding: '11px 0', borderRadius: 12, border: '1px solid rgba(226,136,75,0.3)', background: 'rgba(226,136,75,0.10)', color: '#E2884B', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const input: CSSProperties = { width: '100%', background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.10)', borderRadius: 13, padding: '13px 14px', color: 'var(--text1)', fontFamily: FONT, fontSize: 14, fontWeight: 600, outline: 'none' }
const suggChip: CSSProperties = { fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 20, border: '1px solid rgba(var(--ink-rgb),0.1)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: FONT }
const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', display: 'block', margin: '16px 0 8px' }
const closeBtn: CSSProperties = { width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', border: 'none', cursor: 'pointer', color: 'var(--text1)', fontSize: 14 }
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)' }
const centerOverlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', padding: 24 }
const sheet: CSSProperties = { width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--surface-card)', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(var(--ink-rgb),0.12)', display: 'flex', flexDirection: 'column', maxHeight: 'min(88dvh, 760px)', fontFamily: FONT, boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }
const dialog: CSSProperties = { width: '100%', maxWidth: 360, background: 'var(--surface-pop)', border: '1px solid rgba(var(--ink-rgb),0.12)', borderRadius: 20, padding: '22px 20px', fontFamily: FONT }
const footer: CSSProperties = { padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: 'var(--surface-card)', borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }
const toastStyle: CSSProperties = { position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-pop)', border: '1px solid rgba(0,200,150,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontFamily: FONT, color: '#00C896', zIndex: 10000, whiteSpace: 'nowrap', maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis' }
