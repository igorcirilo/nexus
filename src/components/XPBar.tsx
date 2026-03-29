'use client'
// src/components/XPBar.tsx
import { xpForLevel } from '@/types'

interface Props { xp: number; level: number; title: string }

export default function XPBar({ xp, level, title }: Props) {
  const current = xpForLevel(level - 1)
  const next    = xpForLevel(level)
  const pct     = Math.min(100, Math.round(((xp - current) / (next - current)) * 100))

  return (
    <div className="px-5 mt-4">
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: 'var(--text3)' }}>
        <span>Nível {level} — {title}</span>
        <span>{xp.toLocaleString('pt-PT')} XP</span>
      </div>
    </div>
  )
}
