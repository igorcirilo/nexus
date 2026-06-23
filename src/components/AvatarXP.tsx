'use client'
// src/components/AvatarXP.tsx
// Os níveis vão agora de 1 (Recruta) a 6 (Antifrágil), derivados da ofensiva.

interface AvatarXPProps {
  level: number
  size?: number
  avatarUrl?: string | null
}

function tierColor(level: number) {
  if (level >= 6) return 'url(#nexusAvatarGradient)'
  if (level >= 5) return 'var(--gold)'
  if (level >= 4) return 'var(--accent)'
  if (level >= 3) return 'var(--teal)'
  if (level >= 2) return 'var(--text2)'
  return 'var(--text3)'
}

export default function AvatarXP({ level, size = 48, avatarUrl }: AvatarXPProps) {
  const color = tierColor(level)
  const showGlow = level >= 3
  const showAura = level >= 4
  const showCrown = level >= 5
  const animate = level >= 6

  // Com foto de perfil: foto dentro do anel de nível (mantém a cor do tier)
  if (avatarUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          flexShrink: 0,
          borderRadius: '50%',
          padding: 2,
          background: level >= 6
            ? 'linear-gradient(135deg, var(--gold), var(--teal))'
            : undefined,
          border: level >= 6 ? 'none' : `2px solid ${level >= 5 ? 'var(--gold)' : level >= 4 ? 'var(--accent)' : level >= 3 ? 'var(--teal)' : 'var(--border)'}`,
          boxShadow: showGlow ? '0 0 18px rgba(30,203,180,0.12)' : 'none',
          animation: animate ? 'nexusAvatarPulse 2s ease-in-out infinite' : 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt="Foto de perfil"
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
        <style jsx>{`
          @keyframes nexusAvatarPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(232,168,56,0)); }
            50% { transform: scale(1.04); filter: drop-shadow(0 0 10px rgba(30,203,180,0.22)); }
          }
        `}</style>
      </div>
    )
  }

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
        background: 'var(--surface-2)',
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
            stroke={level >= 6 ? 'url(#nexusAvatarGradient)' : 'var(--accent)'}
            strokeWidth="1.5"
            opacity="0.35"
          />
        )}

        <circle cx="32" cy="19" r={level >= 3 ? 8 : 7} fill={color} opacity={level >= 2 ? 1 : 0.75} />
        <path
          d={level >= 3 ? 'M18 48C18 38 24 32 32 32C40 32 46 38 46 48' : 'M20 48C20 40 25 35 32 35C39 35 44 40 44 48'}
          stroke={color}
          strokeWidth={level >= 3 ? 6 : 5}
          strokeLinecap="round"
        />

        {showGlow && (
          <circle cx="32" cy="19" r="11" stroke={level >= 4 ? 'var(--accent)' : 'var(--teal)'} strokeWidth="1.5" opacity="0.35" />
        )}

        {showCrown && (
          <path
            d="M22 14L27 8L32 14L37 8L42 14V18H22V14Z"
            fill={level >= 6 ? 'url(#nexusAvatarGradient)' : 'var(--gold)'}
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
