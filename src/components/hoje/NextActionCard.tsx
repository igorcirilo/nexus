'use client'

import Icon from '@/components/ui/Icon'

interface NextActionCardProps {
  action: string
}

export default function NextActionCard({ action }: NextActionCardProps) {
  return (
    <section
      aria-label="Próxima ação"
      style={{
        margin: '12px 20px 0',
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(127,119,221,.18), rgba(30,203,180,.08))',
        border: '0.5px solid rgba(127,119,221,.34)',
        boxShadow: '0 18px 48px rgba(127,119,221,.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -28,
          right: -18,
          width: 92,
          height: 92,
          borderRadius: '50%',
          border: '1px solid rgba(232,168,56,.18)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', position: 'relative' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(232,168,56,.12)',
            color: 'var(--gold-ink)',
            border: '0.5px solid rgba(232,168,56,.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="zap" size={22} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-ink)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 5 }}>
            Próxima ação
          </div>
          <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 500, fontSize: 17, lineHeight: 1.38, letterSpacing: 0, color: 'var(--text1)' }}>
            {action}
          </p>
        </div>
      </div>
    </section>
  )
}
