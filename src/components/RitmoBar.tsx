'use client'

import { nextStreakThreshold, titleFromStreak } from '@/types'

interface Props {
  ritmo: number
  level: number
  title: string
  streakBest: number
}

function ritmoColor(ritmo: number) {
  if (ritmo >= 70) return 'var(--teal)'
  if (ritmo >= 40) return 'var(--gold)'
  return '#E24B4A'
}

function ritmoLabel(ritmo: number) {
  if (ritmo >= 85) return 'Em chamas'
  if (ritmo >= 70) return 'Forte'
  if (ritmo >= 40) return 'A construir'
  if (ritmo > 0) return 'A retomar'
  return 'Parado'
}

export default function RitmoBar({ ritmo, level, title, streakBest }: Props) {
  const pct = Math.min(100, Math.max(0, ritmo))
  const color = ritmoColor(ritmo)
  const next = nextStreakThreshold(streakBest)
  const nextTitle = next != null ? titleFromStreak(next) : null
  const toNext = next != null ? Math.max(0, next - streakBest) : 0

  return (
    <div style={{ padding: '14px 20px 0' }}>
      <section
        style={{
          padding: '17px 16px',
          borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
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
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
              <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Nív. {level} · {title}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 17, color }}>
                  {ritmo}
                </span>
                <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 12, color: 'var(--text2)' }}>
                  Ritmo
                </span>
              </div>
            </div>

            <div style={{ background: 'var(--surface-3)', borderRadius: 100, height: 8, position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${color})`,
                  borderRadius: 100,
                  transition: 'width .7s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 13, color: 'var(--text2)', marginTop: 9 }}>
              <span style={{ color }}>{ritmoLabel(ritmo)}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nextTitle
                  ? `${toNext} dias de ofensiva → ${nextTitle}`
                  : 'Nível máximo atingido'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
