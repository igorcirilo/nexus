'use client'
// src/components/AvatarXP.tsx

interface AvatarXPProps {
  level: number
  size?: number
}

function tierColor(level: number) {
  if (level >= 15) return 'url(#nexusAvatarGradient)'
  if (level >= 11) return 'var(--gold)'
  if (level >= 8) return 'var(--accent)'
  if (level >= 5) return 'var(--teal)'
  if (level >= 3) return 'var(--text2)'
  return 'var(--text3)'
}

export default function AvatarXP({ level, size = 48 }: AvatarXPProps) {
  const color = tierColor(level)
  const showGlow = level >= 5
  const showAura = level >= 8
  const showCrown = level >= 11
  const animate = level >= 15

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)',
        border: '0.5px solid var(--border)',
        boxShadow: showGlow ? '0 0 18px rgba(30,203,180,0.12)' : 'none',
        animation: animate ? 'nexusAvatarPulse 2s ease-in-out infinite' : 'none',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="nexusAvatarGradient" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stopColor="var(--gold)" />
            <stop offset="100%" stopColor="var(--teal)" />
          </linearGradient>
        </defs>

        {showAura && (
          <circle
            cx="32"
            cy="32"
            r="27"
            stroke={level >= 15 ? 'url(#nexusAvatarGradient)' : 'var(--accent)'}
            strokeWidth="1.5"
            opacity="0.35"
          />
        )}

        <circle cx="32" cy="19" r={level >= 3 ? 8 : 7} fill={color} opacity={level >= 3 ? 1 : 0.75} />
        <path
          d={level >= 3 ? 'M18 48C18 38 24 32 32 32C40 32 46 38 46 48' : 'M20 48C20 40 25 35 32 35C39 35 44 40 44 48'}
          stroke={color}
          strokeWidth={level >= 3 ? 6 : 5}
          strokeLinecap="round"
        />

        {showGlow && (
          <circle cx="32" cy="19" r="11" stroke={level >= 8 ? 'var(--accent)' : 'var(--teal)'} strokeWidth="1.5" opacity="0.35" />
        )}

        {showCrown && (
          <path
            d="M22 14L27 8L32 14L37 8L42 14V18H22V14Z"
            fill={level >= 15 ? 'url(#nexusAvatarGradient)' : 'var(--gold)'}
            opacity="0.95"
          />
        )}
      </svg>

      <style jsx>{`
        @keyframes nexusAvatarPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(232,168,56,0)); }
          50% { transform: scale(1.04); filter: drop-shadow(0 0 10px rgba(30,203,180,0.22)); }
        }
      `}</style>
    </div>
  )
}
