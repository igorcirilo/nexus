'use client'

import type { CSSProperties } from 'react'
import { AREA_META } from '@/types'
import type { Goal90, HabitArea } from '@/types'

const FONT = 'Inter, sans-serif'

export type HubMilestone = {
  id: string
  goal_id: string
  title: string
  done: boolean
}

interface Props {
  goals: Goal90[]
  milestones: Record<string, HubMilestone[]>
  onDetails: () => void
  onAdd: () => void
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
      marginBottom: 10, marginTop: 18,
      ...style,
    }}>
      {children}
    </div>
  )
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const iconBtn: CSSProperties = {
  width: 38, height: 38, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
}

function formatDeadline(endDate: string): string {
  const d = new Date(endDate + 'T12:00:00')
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function daysLeft(endDate: string): number {
  const end   = new Date(endDate + 'T12:00:00')
  const today = new Date()
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86400000))
}

export default function ObjetivosHub({ goals, milestones, onDetails, onAdd }: Props) {
  const active   = goals.filter(g => g.status === 'active')
  const focusGoal = active[0] ?? null
  const nextDeadline = active.length > 0
    ? active.reduce((min, g) => g.end_date < min ? g.end_date : min, active[0].end_date)
    : null

  // Next actions: first undone milestone per goal
  const nextActions = active
    .flatMap(g => {
      const ms = milestones[g.id] ?? []
      const next = ms.find(m => !m.done)
      if (!next) return []
      return [{ milestone: next, goal: g }]
    })
    .slice(0, 4)

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100vh', padding: '0 22px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Objetivos</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {active.length} ativo{active.length !== 1 ? 's' : ''}
            {nextDeadline ? ` · Prazo: ${formatDeadline(nextDeadline)}` : ''}
          </div>
        </div>
        <button onClick={onAdd} style={iconBtn} aria-label="Novo objetivo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* ── Focus banner ── */}
      {focusGoal ? (
        <div
          onClick={onDetails}
          style={{
            background: 'linear-gradient(135deg, #1A0E00 0%, #201200 100%)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 20, padding: '16px 18px', margin: '14px 0',
            display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,200,66,0.6)', marginBottom: 3 }}>
              Foco principal agora
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {focusGoal.title}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      ) : (
        <div
          onClick={onAdd}
          style={{
            background: 'rgba(245,200,66,0.04)', border: '1px dashed rgba(245,200,66,0.2)',
            borderRadius: 20, padding: '24px 18px', margin: '14px 0',
            textAlign: 'center', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Sem objetivos ativos</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5C842' }}>Criar primeiro objetivo</div>
        </div>
      )}

      {/* ── Objetivos ativos ── */}
      {active.length > 0 && (
        <>
          <SectionLabel>Objetivos ativos</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {active.map((g, idx) => {
              const area     = AREA_META[g.area as HabitArea]
              const color    = area?.color ?? '#9D5CF5'
              const isPriority = idx === 0
              const msList   = milestones[g.id] ?? []
              const msDone   = msList.filter(m => m.done).length
              const nextMs   = msList.find(m => !m.done)
              const dl       = daysLeft(g.end_date)

              return (
                <div
                  key={g.id}
                  onClick={onDetails}
                  style={{
                    background: isPriority ? hexAlpha('#F5C842', 0.04) : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isPriority ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 20, padding: '18px 18px',
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {isPriority && (
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                      color: '#F5C842', background: 'rgba(245,200,66,0.12)',
                      borderRadius: 5, padding: '3px 7px',
                    }}>
                      FOCO
                    </div>
                  )}

                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: hexAlpha(color, 0.12),
                      color: color, fontWeight: 800, fontSize: 15,
                    }}>
                      {(area?.label ?? g.area).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: isPriority ? 52 : 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 3, lineHeight: 1.2 }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                        Prazo: {formatDeadline(g.end_date)}
                        {dl <= 14 && dl > 0 && <span style={{ color: '#FF6B6B', marginLeft: 6 }}>· {dl}d restantes</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: isPriority ? '#F5C842' : color, flexShrink: 0 }}>
                      {g.progress}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                        {area?.label ?? g.area}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                        {msList.length > 0 ? `${msDone} de ${msList.length} marcos` : `${g.progress}% concluído`}
                      </span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 10, width: `${g.progress}%`,
                        background: isPriority
                          ? 'linear-gradient(90deg, #F5C842, #E07B2A)'
                          : `linear-gradient(90deg, ${color}, ${color}BB)`,
                      }} />
                    </div>
                  </div>

                  {/* Milestones (up to 3) */}
                  {msList.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {msList.slice(0, 3).map((m, mi) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 800,
                            ...(m.done
                              ? { background: 'rgba(0,200,150,0.2)', color: '#00C896', border: '1.5px solid rgba(0,200,150,0.4)' }
                              : { background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.3)' }
                            ),
                          }}>
                            {m.done ? '✓' : String(mi + 1)}
                          </div>
                          <div style={{
                            fontSize: 12, fontWeight: 500,
                            color: m.done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.8)',
                            textDecoration: m.done ? 'line-through' : 'none',
                            textDecorationColor: 'rgba(255,255,255,0.2)',
                          }}>
                            {m.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Próximas ações ── */}
      {nextActions.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 18 }}>Próximas ações</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextActions.map(({ milestone, goal }) => {
              const area  = AREA_META[goal.area as HabitArea]
              const color = area?.color ?? '#9D5CF5'
              const dl    = daysLeft(goal.end_date)
              return (
                <div
                  key={milestone.id}
                  onClick={onDetails}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                    {milestone.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {dl <= 7 ? `${dl}d` : area?.label.split(' ')[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* CTA */}
      <button
        onClick={onDetails}
        style={{
          marginTop: 24, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
          fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
        Gerir objetivos
      </button>
    </div>
  )
}
