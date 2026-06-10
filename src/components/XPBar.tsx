'use client'

import { xpForLevel } from '@/types'

interface Props {
  xp: number
  level: number
  title: string
}

export default function XPBar({ xp, level, title }: Props) {
  const current = xpForLevel(level - 1)
  const next = xpForLevel(level)
  const pct = Math.min(100, Math.round(((xp - current) / (next - current)) * 100))
  const toNext = Math.max(0, next - xp)
  const levelXp = Math.max(0, xp - current)
  const neededXp = Math.max(1, next - current)

  return (
    <div style={{ padding: '14px 20px 0' }}>
      <section
        style={{
          padding: '17px 16px',
          borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(28,32,48,.98), rgba(20,23,32,.98))',
          border: '0.5px solid var(--border)',
          boxShadow: '0 14px 40px rgba(0,0,0,.16)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="58" height="58" viewBox="0 0 64 64" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
            <polygon points="32 4 56 18 56 46 32 60 8 46 8 18" stroke="rgba(232,168,56,.72)" strokeWidth="3" />
            <text x="32" y="40" textAnchor="middle" fill="var(--gold)" fontFamily="DM Sans, sans-serif" fontSize="25" fontWeight="700">
              {level}
            </text>
          </svg>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
              <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Nív. {level} · {title}
              </div>
              <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                {levelXp.toLocaleString('pt-PT')} / {neededXp.toLocaleString('pt-PT')} XP
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 100, height: 8, position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--gold), #F0C060)',
                  borderRadius: 100,
                  transition: 'width .7s ease',
                }}
              />
            </div>

            <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 13, color: 'var(--text2)', marginTop: 9 }}>
              {toNext.toLocaleString('pt-PT')} XP para o Nív. {level + 1}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
