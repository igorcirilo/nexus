'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { darkCardInk } from '@/lib/theme'
import { AREA_META } from '@/types'
import type { Goal90, HabitArea } from '@/types'
import { GOAL_SUGGESTIONS, GOAL_SIZE_META, GOAL_SIZE_ORDER, type GoalSize } from '@/lib/goal-suggestions'

const FONT = 'Inter, sans-serif'

function normalizeTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export type HubMilestone = {
  id: string
  goal_id: string
  title: string
  done: boolean
}

interface Props {
  goals: Goal90[]
  milestones: Record<string, HubMilestone[]>
  onOpenGoal: (goalId: string) => void
  onAdd: () => void
  onAddSuggestion: (title: string, area: HabitArea) => void
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text3)',
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
  background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text1)', cursor: 'pointer',
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

export default function ObjetivosHub({ goals, milestones, onOpenGoal, onAdd, onAddSuggestion }: Props) {
  const [sugSize, setSugSize] = useState<GoalSize>('pequeno')
  const [sugAreaKey, setSugAreaKey] = useState<string>(GOAL_SUGGESTIONS[0].key)

  const existingTitles = new Set(goals.map(g => normalizeTitle(g.title)))
  const sugArea = GOAL_SUGGESTIONS.find(a => a.key === sugAreaKey) ?? GOAL_SUGGESTIONS[0]
  const sugCards = sugArea.suggestions[sugSize]

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
    <div style={{ fontFamily: FONT, background: 'var(--surface-page)', minHeight: '100dvh', padding: '0 22px 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Objetivos</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
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
          onClick={() => onOpenGoal(focusGoal.id)}
          style={{
            ...darkCardInk,
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {focusGoal.title}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Sem objetivos ativos</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5C842' }}>Criar primeiro objetivo</div>
        </div>
      )}

      {/* ── Modelos / sugestões prontas ── */}
      <SectionLabel>Modelos para começar</SectionLabel>

      {/* Filtro por tamanho */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {GOAL_SIZE_ORDER.map(size => {
          const on = sugSize === size
          return (
            <button
              key={size}
              onClick={() => setSugSize(size)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 11, cursor: 'pointer',
                fontFamily: FONT, fontSize: 12, fontWeight: 700,
                background: on ? 'rgba(245,200,66,0.14)' : 'rgba(var(--ink-rgb),0.04)',
                border: on ? '1px solid rgba(245,200,66,0.5)' : '1px solid rgba(var(--ink-rgb),0.08)',
                color: on ? '#F5C842' : 'rgba(var(--ink-rgb),0.5)',
              }}
            >
              {GOAL_SIZE_META[size].label}
            </button>
          )
        })}
      </div>

      {/* Filtro por área */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        {GOAL_SUGGESTIONS.map(a => {
          const on = sugAreaKey === a.key
          return (
            <button
              key={a.key}
              onClick={() => setSugAreaKey(a.key)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 11px', borderRadius: 999, cursor: 'pointer',
                fontFamily: FONT, fontSize: 12, fontWeight: 600,
                background: on ? 'rgba(var(--ink-rgb),0.10)' : 'rgba(var(--ink-rgb),0.03)',
                border: on ? '1px solid rgba(var(--ink-rgb),0.28)' : '1px solid rgba(var(--ink-rgb),0.08)',
                color: on ? '#fff' : 'rgba(var(--ink-rgb),0.55)',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 14 }}>{a.icon}</span>{a.label}
            </button>
          )
        })}
      </div>

      {/* Cards de modelo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {sugCards.map(title => {
          const added = existingTitles.has(normalizeTitle(title))
          const color = AREA_META[sugArea.area]?.color ?? '#9D5CF5'
          return (
            <div
              key={title}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--surface-2)',
                border: '1px solid rgba(var(--ink-rgb),0.07)',
                borderRadius: 16, padding: '14px 14px',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hexAlpha(color, 0.12), fontSize: 17,
              }}>
                {sugArea.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
                  {title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3, fontWeight: 500 }}>
                  {sugArea.label} · {GOAL_SIZE_META[sugSize].label.slice(0, -1).toLowerCase()} objetivo
                </div>
              </div>
              {added ? (
                <span style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 700, color: '#00C896',
                  background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.25)',
                  borderRadius: 999, padding: '7px 11px',
                }}>
                  ✓ Adicionado
                </span>
              ) : (
                <button
                  onClick={() => onAddSuggestion(title, sugArea.area)}
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: FONT, fontSize: 12, fontWeight: 700, color: '#F5C842',
                    background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.4)',
                    borderRadius: 999, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  adicionar +
                </button>
              )}
            </div>
          )
        })}
      </div>

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
                  onClick={() => onOpenGoal(g.id)}
                  style={{
                    background: isPriority ? hexAlpha('#F5C842', 0.04) : 'rgba(var(--ink-rgb),0.03)',
                    border: `1px solid ${isPriority ? 'rgba(245,200,66,0.2)' : 'rgba(var(--ink-rgb),0.07)'}`,
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
                      fontSize: 18,
                    }}>
                      {area?.icon ?? '🎯'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: isPriority ? 52 : 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, lineHeight: 1.2 }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                        Prazo: {formatDeadline(g.end_date)}
                        {dl <= 14 && dl > 0 && <span style={{ color: '#FF6B6B', marginLeft: 6 }}>· {dl}d restantes</span>}
                      </div>
                    </div>
                  </div>

                  {/* Área + contagem de marcos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: msList.length > 0 ? 12 : 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {area?.label ?? g.area}
                    </span>
                    {msList.length > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>
                        {msDone} de {msList.length} marcos
                      </span>
                    )}
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
                              : { background: 'transparent', border: '1.5px solid rgba(var(--ink-rgb),0.2)', color: 'var(--text3)' }
                            ),
                          }}>
                            {m.done ? '✓' : String(mi + 1)}
                          </div>
                          <div style={{
                            fontSize: 12, fontWeight: 500,
                            color: m.done ? 'rgba(var(--ink-rgb),0.45)' : 'rgba(var(--ink-rgb),0.8)',
                            textDecoration: m.done ? 'line-through' : 'none',
                            textDecorationColor: 'rgba(var(--ink-rgb),0.2)',
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
                  onClick={() => onOpenGoal(goal.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.06)',
                    borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
                    {milestone.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {dl <= 7 ? `${dl}d` : area?.label.split(' ')[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
