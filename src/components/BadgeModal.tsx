// src/components/BadgeModal.tsx
'use client'

import Icon from '@/components/ui/Icon'
import { badgeIcon } from '@/lib/badges'

const BADGE_DESC: Record<string, string> = {
  primeiro_checkin: 'Fizeste o teu primeiro check-in. O começo é o mais difícil.',
  streak_7:         'Uma semana completa de consistência. Isso não é sorte.',
  streak_21:        'Três semanas. Já é quase um hábito automático.',
  streak_100:       'Cem dias. Isso é raro. Genuinamente raro.',
  ritmo_80:         'O teu Ritmo chegou a 80. Estás em fluxo.',
  consistencia_30:  'A tua melhor ofensiva chegou aos 30 dias. Inabalável.',
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--gold-ink)' }}>
          <Icon name={badgeIcon(badge.key)} size={56} style={{ strokeWidth: 1.4 }} />
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 800,
          fontSize: 10, letterSpacing: 2.5,
          color: 'var(--gold-ink)', marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          Conquista desbloqueada
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 700,
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
            background: 'var(--gold)', color: 'var(--on-bright)',
            border: 'none', borderRadius: 12,
            padding: '13px 36px',
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
