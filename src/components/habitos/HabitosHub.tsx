'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

const FONT = 'Inter, sans-serif'

export interface HubHabit {
  id: string
  name: string
  area: string
  xp_reward: number
  time_window: string | null
  /** Rótulo de frequência (ex.: "Dias úteis", "3x · Seg, Qua, Sex"). */
  freq?: string
  done: boolean
}
export interface HubArea {
  key: string
  label: string
  icon: string
  color: string
  done: number
  total: number
  pct: number
}

interface Props {
  habits: HubHabit[]
  areas: HubArea[]
  doneToday: number
  totalToday: number
  onToggle: (habitId: string, done: boolean) => void
  onAdd: () => void
  onEdit: (habitId: string) => void
  onDelete: (habitId: string) => void
  onOpenLibrary?: () => void
}

export default function HabitosHub({ habits, areas, doneToday, totalToday, onToggle, onAdd, onEdit, onDelete, onOpenLibrary }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const rings = [...areas].sort((a, b) => b.total - a.total).slice(0, 3)
  const visibleAreas = areas.filter((a) => filter === 'all' || a.key === filter)

  return (
    <div
      style={{ fontFamily: FONT, background: 'var(--surface-page)', minHeight: '100dvh', padding: '0 22px 40px' }}
      onClick={() => menuFor && setMenuFor(null)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Hábitos</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>
            {totalToday > 0 ? `${doneToday} de ${totalToday} concluídos hoje` : 'Sem hábitos ativos'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onOpenLibrary && (
            <button onClick={onOpenLibrary} aria-label="Biblioteca de hábitos" style={libBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
          )}
          <button onClick={onAdd} aria-label="Novo hábito" style={plusBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress rings */}
      {rings.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, marginTop: 12 }}>
          {rings.map((a) => (
            <div key={a.key} style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
              <Ring pct={a.pct} color={a.color} />
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        <Chip label="Todos" active={filter === 'all'} onClick={() => setFilter('all')} />
        {areas.map((a) => (
          <Chip key={a.key} label={`${a.icon} ${a.label}`} active={filter === a.key} onClick={() => setFilter(a.key)} />
        ))}
      </div>

      {/* Grouped habit list */}
      {visibleAreas.length === 0 ? (
        <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
          Nenhum hábito nesta área. Toca em + para criar.
        </div>
      ) : (
        visibleAreas.map((a, idx) => {
          const items = habits.filter((h) => h.area === a.key)
          if (items.length === 0) return null
          return (
            <div key={a.key} style={{ marginTop: idx === 0 ? 0 : 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{a.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{a.done}/{a.total}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                {items.map((h) => (
                  <HabitItem
                    key={h.id}
                    habit={h}
                    areaLabel={a.label}
                    menuOpen={menuFor === h.id}
                    onToggle={onToggle}
                    onMenu={() => setMenuFor(menuFor === h.id ? null : h.id)}
                    onEdit={() => { setMenuFor(null); onEdit(h.id) }}
                    onDelete={() => { setMenuFor(null); onDelete(h.id) }}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Area progress bars */}
      {areas.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, marginTop: 22 }}>
            Progresso por área
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {areas.map((a) => (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', minWidth: 92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 10, width: `${a.pct}%`, background: a.color }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', minWidth: 30, textAlign: 'right' }}>{a.pct}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── subcomponents ────────────────────────────────────────────────

function HabitItem({ habit, areaLabel, menuOpen, onToggle, onMenu, onEdit, onDelete }: {
  habit: HubHabit
  areaLabel: string
  menuOpen: boolean
  onToggle: (id: string, done: boolean) => void
  onMenu: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const done = habit.done
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: done ? 'rgba(0,200,150,0.05)' : 'rgba(var(--ink-rgb),0.03)',
        border: `1px solid ${done ? 'rgba(0,200,150,0.15)' : 'rgba(var(--ink-rgb),0.07)'}`,
        borderRadius: 16,
        padding: '14px 12px 14px 16px',
        transition: 'all .2s',
        position: 'relative',
        zIndex: menuOpen ? 5 : 'auto',
      }}
    >
      <button
        onClick={() => onToggle(habit.id, !done)}
        aria-label={done ? `Desmarcar ${habit.name}` : `Marcar ${habit.name}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          border: `2px solid ${done ? '#00C896' : 'rgba(var(--ink-rgb),0.2)'}`,
          background: done ? '#00C896' : 'transparent',
          color: done ? '#001A10' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ✓
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: done ? 'rgba(var(--ink-rgb),0.55)' : 'rgba(var(--ink-rgb),0.9)',
            marginBottom: 3,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'rgba(var(--ink-rgb),0.2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {habit.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.time_window || areaLabel}</span>
          {habit.freq && habit.freq !== 'Todos os dias' && (
            <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--teal)', background: 'rgba(30,203,180,0.10)', borderRadius: 6, padding: '2px 6px' }}>
              {habit.freq}
            </span>
          )}
        </div>
      </div>

      {/* Ações secundárias: menu discreto (área de toque 44px com padding invisível) */}
      <button
        onClick={(e) => { e.stopPropagation(); onMenu() }}
        aria-label={`Mais ações para ${habit.name}`}
        aria-expanded={menuOpen}
        style={{
          width: 44,
          height: 44,
          margin: '-7px -7px -7px 0',
          flexShrink: 0,
          border: 'none',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{
          width: 30, height: 30, borderRadius: 10,
          background: menuOpen ? 'rgba(245,200,66,0.10)' : 'rgba(var(--ink-rgb),0.04)',
          border: `1px solid ${menuOpen ? 'rgba(245,200,66,0.4)' : 'rgba(var(--ink-rgb),0.06)'}`,
          color: menuOpen ? '#F5C842' : 'rgba(var(--ink-rgb),0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
          </svg>
        </span>
      </button>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', right: 10, top: 'calc(100% - 6px)', zIndex: 10, width: 190,
            background: 'var(--surface-pop)', border: '1px solid rgba(var(--ink-rgb),0.12)', borderRadius: 16,
            boxShadow: '0 18px 50px rgba(0,0,0,0.65)', overflow: 'hidden',
          }}
        >
          <button onClick={onEdit} style={menuItem}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar hábito
          </button>
          <button onClick={onDelete} style={{ ...menuItem, color: '#E24B4A', borderBottom: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Apagar
          </button>
        </div>
      )}
    </div>
  )
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div style={{ width: 54, height: 54, margin: '0 auto', position: 'relative' }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="27" cy="27" r={r} fill="none" stroke="rgba(var(--ink-rgb),0.08)" strokeWidth="4" />
        <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{pct}%</div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? 'rgba(245,200,66,0.3)' : 'rgba(var(--ink-rgb),0.1)'}`,
        color: active ? '#F5C842' : 'rgba(var(--ink-rgb),0.5)',
        background: active ? 'rgba(245,200,66,0.12)' : 'transparent',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const plusBtn: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'rgba(245,200,66,0.14)',
  border: '1px solid rgba(245,200,66,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#F5C842',
  cursor: 'pointer',
}

const libBtn: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'rgba(var(--ink-rgb),0.05)',
  border: '1px solid rgba(var(--ink-rgb),0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text2)',
  cursor: 'pointer',
}

const menuItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  padding: '13px 14px',
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: FONT,
  color: 'var(--text1)',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(var(--ink-rgb),0.06)',
  cursor: 'pointer',
  textAlign: 'left',
}
