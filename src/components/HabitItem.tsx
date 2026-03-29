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

  async function toggle() {
    const newDone = !done
    setDone(newDone)
    await toggleHabitLog(userId, habit.id, date, newDone)
    if (newDone) {
      const area = AREA_META[habit.area]
      onXP(habit.xp_reward, `+${habit.xp_reward} XP — ${habit.name}`)
    }
  }

  const area = AREA_META[habit.area]

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left"
      style={{
        background: done ? 'rgba(30,203,180,.04)' : 'var(--bg2)',
        borderColor: done ? 'rgba(30,203,180,.22)' : 'var(--border)',
      }}>
      {/* Checkbox */}
      <div className="w-6 h-6 rounded-lg border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all"
           style={{
             background: done ? 'var(--teal)' : 'transparent',
             borderColor: done ? 'var(--teal)' : 'var(--text3)',
           }}>
        {done && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none"
               stroke="var(--bg0)" strokeWidth="2.5">
            <polyline points="1,4.5 4.5,8 11,1"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-1 truncate">{habit.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-text-3">{area?.label}</span>
          {habit.time_window && (
            <span className="text-[10px] text-text-3 bg-bg-3 px-1.5 py-0.5 rounded-md">
              {habit.time_window}
            </span>
          )}
        </div>
      </div>

      {/* XP */}
      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--gold)' }}>
        +{habit.xp_reward} XP
      </span>
    </button>
  )
}
