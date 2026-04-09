// src/components/BadgeModal.tsx
'use client'

const BADGE_ICONS: Record<string, string> = {
  primeiro_checkin: '🌅',
  streak_7:         '🔥',
  streak_21:        '⚡',
  streak_100:       '🏆',
  xp_1000:          '💎',
  xp_5000:          '🌟',
  xp_10000:         '👑',
}

const BADGE_DESC: Record<string, string> = {
  primeiro_checkin: 'Fizeste o teu primeiro check-in. O começo é o mais difícil.',
  streak_7:         'Uma semana completa de consistência. Isso não é sorte.',
  streak_21:        'Três semanas. Já é quase um hábito automático.',
  streak_100:       'Cem dias. Isso é raro. Genuinamente raro.',
  xp_1000:          'Mil pontos conquistados. Estás a construir algo real.',
  xp_5000:          'Veterano. 5000 XP de trabalho acumulado.',
  xp_10000:         'Elite. Chegar aqui exige quem não para.',
}

interface Props {
  badges: { key: string; name: string }[]
  onClose: () => void
}

export default function BadgeModal({ badges, onClose }: Props) {
  if (badges.length === 0) return null
  const badge = badges[0]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9998, padding: 24,
        animation: 'fadeUp .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '0.5px solid rgba(232,168,56,.4)',
          borderRadius: 24, padding: '36px 28px',
          maxWidth: 320, width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}>
          {BADGE_ICONS[badge.key] ?? '🎖️'}
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 10, letterSpacing: 2.5,
          color: 'var(--gold)', marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          Conquista desbloqueada
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700,
          fontSize: 22, color: 'var(--text1)', marginBottom: 12,
        }}>
          {badge.name}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 28 }}>
          {BADGE_DESC[badge.key] ?? ''}
        </p>
        <button
          onClick={onClose}
          style={{
            background: 'var(--gold)', color: 'var(--bg0)',
            border: 'none', borderRadius: 12,
            padding: '13px 36px',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
