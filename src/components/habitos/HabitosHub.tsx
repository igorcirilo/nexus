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
  done: boolean
}
export interface HubArea {
  key: string
  label: string
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
  onManage: () => void
}

export default function HabitosHub({ habits, areas, doneToday, totalToday, onToggle, onManage }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const rings = [...areas].sort((a, b) => b.total - a.total).slice(0, 3)
  const visibleAreas = areas.filter((a) => filter === 'all' || a.key === filter)

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100vh', padding: '0 22px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Hábitos</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 2 }}>
            {totalToday > 0 ? `${doneToday} de ${totalToday} concluídos hoje` : 'Sem hábitos ativos'}
          </div>
        </div>
        <button onClick={onManage} aria-label="Gerir hábitos" style={iconBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Progress rings */}
      {rings.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, marginTop: 12 }}>
          {rings.map((a) => (
            <div key={a.key} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
              <Ring pct={a.pct} color={a.color} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        <Chip label="Todos" active={filter === 'all'} onClick={() => setFilter('all')} />
        {areas.map((a) => (
          <Chip key={a.key} label={a.label} active={filter === a.key} onClick={() => setFilter(a.key)} />
        ))}
      </div>

      {/* Grouped habit list */}
      {visibleAreas.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
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
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{a.label}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{a.done}/{a.total}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                {items.map((h) => (
                  <HabitItem key={h.id} habit={h} areaLabel={a.label} onToggle={onToggle} />
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Area progress bars */}
      {areas.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, marginTop: 22 }}>
            Progresso por área
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {areas.map((a) => (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', minWidth: 92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 10, width: `${a.pct}%`, background: a.color }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', minWidth: 30, textAlign: 'right' }}>{a.pct}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── subcomponents ────────────────────────────────────────────────

function HabitItem({ habit, areaLabel, onToggle }: { habit: HubHabit; areaLabel: string; onToggle: (id: string, done: boolean) => void }) {
  const done = habit.done
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: done ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${done ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        transition: 'all .2s',
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
          border: `2px solid ${done ? '#00C896' : 'rgba(255,255,255,0.2)'}`,
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
            color: done ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)',
            marginBottom: 3,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {habit.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.time_window || areaLabel}</span>
          <span style={{ color: '#F5C842', fontWeight: 700, flexShrink: 0 }}>+{habit.xp_reward} XP</span>
        </div>
      </div>
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
        <circle cx="27" cy="27" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 13, fontWeight: 800, color: '#fff' }}>{pct}%</div>
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
        border: `1px solid ${active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.1)'}`,
        color: active ? '#F5C842' : 'rgba(255,255,255,0.5)',
        background: active ? 'rgba(245,200,66,0.12)' : 'transparent',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const iconBtn: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
}
