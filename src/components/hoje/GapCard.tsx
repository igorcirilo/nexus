'use client'

import Icon from '@/components/ui/Icon'

interface GapCardProps {
  habitName: string
  areaLabel: string
  color: string
  days: number
  onShow: () => void
  onDismiss: () => void
}

/**
 * Mentor de lacuna: uma proposta de cada vez, com o porquê, dispensável. Só
 * aparece quando há uma lacuna real (ver lib/gaps) — nunca conselho genérico.
 */
export default function GapCard({ habitName, areaLabel, color, days, onShow, onDismiss }: GapCardProps) {
  return (
    <section
      aria-label="Sugestão do mentor"
      style={{
        margin: '12px 20px 0',
        padding: '16px 18px',
        borderRadius: 20,
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(232,168,56,.12)', color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="clock" size={16} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: 'var(--text1)', marginBottom: 4 }}>
            {habitName} parado há {days} dias
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text2)' }}>
            <span style={{ color, fontWeight: 600 }}>{areaLabel}</span> — sem drama. Retomamos hoje com um gesto?
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={onShow}
          style={{
            minHeight: 44,
            border: 'none',
            borderRadius: 12,
            background: 'rgba(232,168,56,.14)',
            color: 'var(--gold)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Mostrar na lista
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            minHeight: 44,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            padding: '0 6px',
            fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
            fontSize: 14,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Agora não
        </button>
      </div>
    </section>
  )
}
