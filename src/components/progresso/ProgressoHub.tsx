'use client'

import type { CSSProperties } from 'react'
import { xpForLevel } from '@/types'
import type { Profile, UserBadge } from '@/types'

const FONT = 'Inter, sans-serif'

const BADGE_DEFS = [
  { key: 'streak_7',     icon: '🔥', name: '7 dias'      },
  { key: 'streak_14',    icon: '🔥', name: '14 dias'     },
  { key: 'streak_30',    icon: '🏆', name: '30 dias'     },
  { key: 'streak_90',    icon: '💎', name: '90 dias'     },
  { key: 'energy_max',   icon: '⚡', name: 'Energia máx' },
  { key: 'mission_done', icon: '🎯', name: 'Missão'      },
  { key: 'focus_10',     icon: '🧠', name: 'Foco x10'    },
  { key: 'all_habits',   icon: '✨', name: 'Perfeito'    },
]

export type HubAreaProgress = {
  key: string
  label: string
  icon: string
  color: string
  pct: number
  done: number
  total: number
}

interface Props {
  profile: Profile
  areas: HubAreaProgress[]
  badges: UserBadge[]
  earnedKeys: Set<string>
  consistency: number
  xpData: { day: string; xp: number }[]
  onDashboard: () => void
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
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

const ctaBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
  fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

export default function ProgressoHub({
  profile,
  areas,
  badges,
  earnedKeys,
  consistency,
  xpData,
  onDashboard,
}: Props) {
  const level     = profile.level
  const xp        = profile.xp_total
  const prev      = xpForLevel(level - 1)
  const next      = xpForLevel(level)
  const levelPct  = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100))
  const xpToNext  = next - xp
  const curXP     = xp - prev
  const totalXP   = next - prev

  const maxXP = Math.max(1, ...xpData.map(d => d.xp))

  // Earned badges: most recent first; newestKey highlights with teal "Novo"
  const earnedSorted = BADGE_DEFS.filter(b => earnedKeys.has(b.key)).sort((a, b) => {
    const aAt = badges.find(ub => ub.badge_key === a.key)?.earned_at ?? ''
    const bAt = badges.find(ub => ub.badge_key === b.key)?.earned_at ?? ''
    return bAt.localeCompare(aAt)
  })
  const newestKey   = earnedSorted[0]?.key ?? null
  const lockedDefs  = BADGE_DEFS.filter(b => !earnedKeys.has(b.key))
  const displayBadges = [...earnedSorted.slice(0, 4), ...lockedDefs.slice(0, Math.max(1, 5 - earnedSorted.length))]

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100dvh', padding: '0 22px 40px' }}>

      {/* Header */}
      <div style={{ padding: '20px 0 4px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Progresso</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          Nível {level} · {profile.title}
        </div>
      </div>

      {/* ── Level Hero ── */}
      <div
        onClick={onDashboard}
        style={{
          background: 'linear-gradient(135deg, #130D2A 0%, #1A0E3A 50%, #0D1A2E 100%)',
          border: '1px solid rgba(157,92,245,0.25)',
          borderRadius: 26, padding: '24px 22px',
          margin: '14px 0 14px', position: 'relative', overflow: 'hidden', cursor: 'pointer',
        }}
      >
        <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(157,92,245,0.2) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -20, width: 140, height: 140,
          background: 'radial-gradient(circle, rgba(0,212,200,0.1) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(157,92,245,0.15)', border: '1px solid rgba(157,92,245,0.3)',
              borderRadius: 20, padding: '5px 12px', marginBottom: 10,
              fontSize: 11, fontWeight: 700, color: '#9D5CF5', letterSpacing: '0.04em',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {profile.title}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Nível atual</div>
            <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-3px', lineHeight: 1 }}>{level}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              {xpToNext.toLocaleString('pt-PT')} XP para Nível {level + 1}
            </div>
          </div>

          {/* Right: donut + streak pill */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 80, position: 'relative' }}>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(157,92,245,0.15)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#9D5CF5" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="213.6"
                  strokeDashoffset={213.6 * (1 - levelPct / 100)}
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{levelPct}%</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>nível</div>
              </div>
            </div>
            {/* Streak pill (ranking não existe no app — substituído por streak atual) */}
            <div style={{
              background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)',
              borderRadius: 10, padding: '6px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F5C842' }}>
                {profile.streak_current}
                <span style={{ fontSize: 12 }}> 🔥</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(245,200,66,0.5)', fontWeight: 500 }}>streak</div>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              {curXP.toLocaleString('pt-PT')} XP
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}>
              {totalXP.toLocaleString('pt-PT')} XP
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${levelPct}%`,
              background: 'linear-gradient(90deg, #9D5CF5, #00D4C8)', borderRadius: 10 }} />
          </div>
        </div>
      </div>

      {/* ── Consistência semanal ── */}
      <SectionLabel>Consistência semanal</SectionLabel>
      <div
        onClick={onDashboard}
        style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: '18px 20px', marginBottom: 14, cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Esta semana</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00C896' }}>{consistency}%</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
          {xpData.map((d, i) => {
            const isToday  = i === xpData.length - 1
            const heightPct = isToday
              ? Math.max(8, Math.round((d.xp / maxXP) * 100))
              : d.xp > 0 ? Math.max(20, Math.round((d.xp / maxXP) * 100)) : 8
            const bg = isToday
              ? 'rgba(0,212,200,0.5)'
              : d.xp > 0 ? '#00C896' : 'rgba(255,80,80,0.3)'
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: '100%', borderRadius: '6px 6px 0 0',
                  background: bg, height: `${heightPct}%`,
                  ...(isToday ? { border: '1.5px solid #00D4C8' } : {}),
                }} />
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: isToday ? '#00D4C8' : 'rgba(255,255,255,0.3)',
                }}>
                  {d.day.charAt(0)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Áreas da vida ── */}
      <SectionLabel>Áreas da vida</SectionLabel>
      <div
        onClick={onDashboard}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', marginBottom: 4 }}
      >
        {areas.map(a => (
          <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hexAlpha(a.color, 0.12),
              fontSize: 16,
            }}>
              {a.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>
                {a.label}
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 10, width: `${a.pct}%`, background: a.color }} />
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: 32, textAlign: 'right' }}>
              {a.total > 0 ? `${a.pct}%` : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Conquistas recentes ── */}
      <SectionLabel style={{ marginTop: 20 }}>Conquistas recentes</SectionLabel>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {displayBadges.map(b => {
          const isEarned = earnedKeys.has(b.key)
          const isNewest = isEarned && b.key === newestKey
          return (
            <div key={b.key} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: isNewest
                ? 'rgba(0,212,200,0.06)'
                : isEarned ? 'rgba(245,200,66,0.06)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isNewest
                ? 'rgba(0,212,200,0.3)'
                : isEarned ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 16, padding: '14px 10px', minWidth: 72,
              opacity: isEarned ? 1 : 0.4,
            }}>
              <div style={{ fontSize: 24, lineHeight: 1 }}>{b.icon}</div>
              <div style={{
                fontSize: 10, fontWeight: 600, textAlign: 'center',
                color: isNewest
                  ? 'rgba(0,212,200,0.7)'
                  : isEarned ? 'rgba(245,200,66,0.7)' : 'rgba(255,255,255,0.5)',
              }}>
                {b.name}
              </div>
              {isNewest && (
                <div style={{
                  fontSize: 9, fontWeight: 700, color: '#00D4C8',
                  background: 'rgba(0,212,200,0.12)', borderRadius: 5, padding: '2px 5px',
                }}>
                  Novo
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── CTA nav ── */}
      <button onClick={onDashboard} style={{ ...ctaBtn, width: '100%', marginTop: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="18" y="3" width="4" height="18"/>
          <rect x="10" y="8" width="4" height="13"/>
          <rect x="2" y="13" width="4" height="8"/>
        </svg>
        Abrir dashboard completo
      </button>
    </div>
  )
}
