'use client'
// src/components/XPBar.tsx
import { xpForLevel } from '@/types'

interface Props { xp: number; level: number; title: string }

export default function XPBar({ xp, level, title }: Props) {
  const current = xpForLevel(level - 1)
  const next    = xpForLevel(level)
  const pct     = Math.min(100, Math.round(((xp - current) / (next - current)) * 100))
  const toNext  = Math.max(0, next - xp)

  return (
    <div style={{ padding: '12px 20px 0' }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11,
            color: 'var(--gold)', background: 'rgba(232,168,56,.1)',
            padding: '2px 8px', borderRadius: 6,
          }}>NÍV. {level}</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>{title}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {xp.toLocaleString('pt-PT')} XP
        </span>
      </div>

      {/* Barra */}
      <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--gold), #F0C060)',
          borderRadius: 100,
          transition: 'width .7s ease',
        }} />
      </div>

      {/* Progresso */}
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
        {toNext.toLocaleString('pt-PT')} XP para Nível {level + 1}
      </div>
    </div>
  )
}
