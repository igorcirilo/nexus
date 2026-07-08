'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import SwipeRow from '@/components/ui/SwipeRow'

export interface TodayHabitView {
  id: string
  name: string
  areaLabel: string
  color: string
  timeWindow: string | null
  done: boolean
}

interface TodayHabitListProps {
  habits: TodayHabitView[]
  doneCount: number
  totalCount: number
  onToggle: (id: string, done: boolean) => Promise<void> | void
  onAddHabit: () => void
}

export default function TodayHabitList({ habits, doneCount, totalCount, onToggle, onAddHabit }: TodayHabitListProps) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  async function toggle(h: TodayHabitView) {
    if (savingId) return
    setSavingId(h.id)
    try {
      await onToggle(h.id, !h.done)
    } finally {
      setSavingId(null)
    }
  }

  function goToHabits() {
    window.location.href = '/habitos'
  }

  return (
    <section
      id="habitos-hoje"
      aria-label={`Hábitos de hoje: ${doneCount} de ${totalCount} concluídos`}
      style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}
    >
      <div
        style={{
          display: 'grid',
          gap: 10,
          padding: 16,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
          border: '0.5px solid var(--border)',
          boxShadow: '0 14px 40px rgba(0,0,0,.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2, color: 'var(--text1)' }}>
            Hábitos de hoje
          </h2>
          <a
            href="/habitos"
            style={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--teal)',
              textDecoration: 'none',
              fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
          >
            Ver todos
          </a>
        </div>

        {habits.map((h) => {
          const isSaving = savingId === h.id
          const isBusy = savingId !== null
          return (
            <SwipeRow
              key={h.id}
              open={openSwipeId === h.id}
              onOpenChange={(open) => setOpenSwipeId(open ? h.id : (openSwipeId === h.id ? null : openSwipeId))}
              actionLabel="Editar"
              actionColor="var(--accent)"
              onAction={goToHabits}
              onClickRow={goToHabits}
              borderRadius={15}
            >
              <div
                aria-busy={isSaving}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 10px',
                  borderRadius: 15,
                  background: 'rgba(13,15,20,.2)',
                  border: `0.5px solid ${h.done ? 'rgba(30,203,180,.3)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${h.color}`,
                  opacity: h.done ? 0.62 : isBusy && !isSaving ? 0.5 : 1,
                  minHeight: 44,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void toggle(h) }}
                  disabled={isBusy}
                  aria-pressed={h.done}
                  aria-label={`${h.done ? 'Desmarcar' : 'Concluir'} hábito ${h.name}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    border: h.done ? 'none' : '2px solid var(--text3)',
                    color: 'var(--teal)',
                    background: h.done ? 'rgba(30,203,180,.12)' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    padding: 0,
                    touchAction: 'manipulation',
                  }}
                >
                  {h.done && <Icon name="check" size={16} />}
                </button>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                      fontWeight: 700,
                      fontSize: 16,
                      lineHeight: 1.22,
                      color: h.done ? 'var(--text3)' : 'var(--text1)',
                      textDecoration: h.done ? 'line-through' : 'none',
                      marginBottom: 4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {h.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 7, fontSize: 13, minWidth: 0, alignItems: 'center' }}>
                    <span style={{ color: h.color, fontWeight: 600, flexShrink: 0 }}>{h.areaLabel}</span>
                    {h.timeWindow && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>}
                    {h.timeWindow && (
                      <span style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.timeWindow}</span>
                    )}
                  </div>
                </div>
              </div>
            </SwipeRow>
          )
        })}

        {habits.length === 0 && (
          <div style={{ padding: 18, borderRadius: 16, background: 'rgba(13,15,20,.2)', border: '0.5px solid var(--border)', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Nenhum hábito para hoje.
            <button
              type="button"
              onClick={onAddHabit}
              style={{
                minHeight: 44,
                marginTop: 12,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
                color: 'var(--on-bright)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              Criar hábito
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
