'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BADGE_CATALOG } from '@/lib/badges'
import { AREA_META } from '@/types'
import type { UserBadge, Goal90, HabitArea } from '@/types'

/**
 * Modal Conquistas & Metas: grelha de badges (desbloqueadas/bloqueadas) e
 * metas (objetivos 90 dias) com barra de progresso.
 */

const FONT = 'Inter, sans-serif'

interface Props {
  badges: UserBadge[]
  goals: Goal90[]
  onClose: () => void
}

export default function AchievementsGoalsModal({ badges, goals, onClose }: Props) {
  const [tab, setTab] = useState<'conquistas' | 'metas'>('conquistas')
  const earned = new Set(badges.map((b) => b.badge_key))
  const unlockedCount = BADGE_CATALOG.filter((b) => earned.has(b.key)).length
  const activeGoals = goals.filter((g) => g.status === 'active')
  const [featured, ...rest] = activeGoals

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={sheet}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '11px auto 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0', flexShrink: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Conquistas &amp; Metas</h2>
          <button onClick={onClose} aria-label="Fechar" style={closeBtn}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0', flexShrink: 0 }}>
          <Tab label="🏅 Conquistas" active={tab === 'conquistas'} onClick={() => setTab('conquistas')} />
          <Tab label="🎯 Metas" active={tab === 'metas'} onClick={() => setTab('metas')} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px calc(24px + env(safe-area-inset-bottom))' }}>
          {tab === 'conquistas' ? (
            <>
              <SecLabel>Desbloqueadas · {unlockedCount} de {BADGE_CATALOG.length}</SecLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {BADGE_CATALOG.map((b) => {
                  const on = earned.has(b.key)
                  return (
                    <div key={b.key} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: 62, height: 62, borderRadius: 18, margin: '0 auto',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                          background: on ? `linear-gradient(135deg, ${b.color}38, rgba(127,119,221,.16))` : 'var(--surface-2)',
                          border: on ? `1px solid ${b.color}80` : '1px solid rgba(var(--ink-rgb),0.08)',
                          boxShadow: on ? `0 6px 18px ${b.color}2e` : 'none',
                          filter: on ? 'none' : 'grayscale(1)',
                          opacity: on ? 1 : 0.34,
                        }}
                      >
                        {b.icon}
                      </div>
                      <p style={{ fontSize: 10, color: on ? 'var(--text1)' : 'var(--text3)', fontWeight: 700, marginTop: 7, lineHeight: 1.2 }}>{b.name}</p>
                    </div>
                  )
                })}
              </div>
              <SecLabel>Como desbloquear</SecLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {BADGE_CATALOG.filter((b) => !earned.has(b.key)).map((b) => (
                  <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 14, padding: '11px 13px' }}>
                    <span style={{ fontSize: 20, flexShrink: 0, filter: 'grayscale(1)', opacity: 0.5 }}>{b.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{b.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {activeGoals.length === 0 ? (
                <div style={{ background: 'var(--surface-2)', border: '1px dashed rgba(var(--ink-rgb),0.12)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginTop: 16 }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🎯</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>Sem metas ativas</div>
                  <a href="/objetivos" style={{ display: 'inline-block', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--gold-ink)', textDecoration: 'none' }}>Criar objetivo ›</a>
                </div>
              ) : (
                <>
                  <SecLabel>Meta em destaque</SecLabel>
                  <FeaturedGoal goal={featured} />
                  {rest.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
                      {rest.map((g) => <MiniGoal key={g.id} goal={g} />)}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FeaturedGoal({ goal }: { goal: Goal90 }) {
  const meta = AREA_META[goal.area as HabitArea]
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(127,119,221,.16), rgba(30,203,180,.10))', border: '1px solid rgba(var(--ink-rgb),0.09)', borderRadius: 20, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(var(--ink-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0 }}>{meta?.icon ?? '🎯'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</b>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{meta?.label ?? goal.area} · 90 dias</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: '#9C94EC' }}>{goal.progress}%</span>
      </div>
      <div style={{ height: 9, borderRadius: 6, background: 'rgba(var(--ink-rgb),0.08)', marginTop: 15, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, goal.progress)}%`, borderRadius: 6, background: 'linear-gradient(90deg,#7F77DD,#1ECBB4)' }} />
      </div>
    </div>
  )
}

function MiniGoal({ goal }: { goal: Goal90 }) {
  const meta = AREA_META[goal.area as HabitArea]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 15, padding: '12px 14px' }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{meta?.icon ?? '🎯'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 13.5, color: 'var(--text1)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</b>
        <div style={{ height: 6, borderRadius: 5, background: 'rgba(var(--ink-rgb),0.08)', marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, goal.progress)}%`, borderRadius: 5, background: meta?.color ?? '#1ECBB4' }} />
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>{goal.progress}%</span>
    </div>
  )
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'center', padding: 10, borderRadius: 13, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        background: active ? 'rgba(245,200,66,0.14)' : 'rgba(var(--ink-rgb),0.04)',
        color: active ? 'var(--gold-ink)' : 'var(--text2)',
        border: active ? '1px solid rgba(245,200,66,0.4)' : '1px solid transparent',
      }}
    >
      {label}
    </button>
  )
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: '22px 2px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)' }}>{children}</div>
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.62)' }
const sheet: CSSProperties = { width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--surface-card)', borderRadius: '28px 28px 0 0', borderTop: '1px solid rgba(var(--ink-rgb),0.1)', display: 'flex', flexDirection: 'column', height: 'min(90dvh, 820px)', fontFamily: FONT, boxShadow: '0 -24px 60px rgba(0,0,0,0.6)' }
const closeBtn: CSSProperties = { width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', border: 'none', cursor: 'pointer', color: 'var(--text1)', fontSize: 14, flexShrink: 0 }
