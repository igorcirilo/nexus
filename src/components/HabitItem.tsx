'use client'
// src/components/HabitItem.tsx
import { useState } from 'react'
import { toggleHabitLog } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/types'
import { AREA_META } from '@/types'

interface Props {
  habit: Habit
  log: HabitLog | null
  userId: string
  date: string
  onXP: (xp: number, msg: string) => void
}

export default function HabitItem({ habit, log, userId, date, onXP }: Props) {
  const [done, setDone] = useState(log?.completed ?? false)
  const area = AREA_META[habit.area]

  async function toggle() {
    const newDone = !done
    setDone(newDone)
    await toggleHabitLog(userId, habit.id, date, newDone)
    if (newDone) onXP(habit.xp_reward, `${habit.name} feito!`)
  }

  return (
    <button onClick={toggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
        background: done ? 'rgba(30,203,180,.08)' : 'var(--bg2)',
        outline: done ? '0.5px solid rgba(30,203,180,.25)' : '0.5px solid var(--border)',
        textAlign: 'left', transition: 'all .2s',
      }}>

      {/* Checkbox */}
      <div style={{
        width: 26, height: 26, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'var(--teal)' : 'transparent',
        border: done ? 'none' : '1.5px solid var(--text3)',
        transition: 'all .2s',
      }}>
        {done && (
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none"
               stroke="var(--bg0)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="1.5,5 5,8.5 11.5,1.5"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: done ? 'var(--text2)' : 'var(--text1)',   /* ← texto claro sempre */
          marginBottom: 4,
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {habit.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{area?.label}</span>
          {habit.time_window && (
            <span style={{              /* ← separado com gap, nunca encostado */
              fontSize: 10,
              color: done ? 'var(--text3)' : 'var(--text2)',
              background: 'var(--bg3)',
              padding: '2px 8px', borderRadius: 6,
            }}>
              {habit.time_window}
            </span>
          )}
        </div>
      </div>

      {/* XP */}
      <span style={{
        fontSize: 11, fontWeight: 600, flexShrink: 0,
        color: done ? 'var(--text3)' : 'var(--gold)',
        fontFamily: 'Syne, sans-serif',
      }}>
        {done ? '✓' : `+${habit.xp_reward}`}
      </span>
    </button>
  )
}
