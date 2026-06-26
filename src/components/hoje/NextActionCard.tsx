'use client'

import Icon from '@/components/ui/Icon'

interface NextActionCardProps {
  title: string
  why: string
  ctaLabel: string
  /** Postura "ritmo" (Construtor): colapsa para resumo + atalho. */
  compact?: boolean
  busy?: boolean
  onPrimary: () => void
  onSecondary?: () => void
  secondaryLabel?: string
}

/**
 * O condutor único da home ("A seguir"). Substitui e funde os antigos cartões
 * "Agora" (mentor) e "Missão do dia" — uma só proposta de cada vez, com 1 toque
 * e o porquê. Em postura "ritmo" colapsa; em "recomeço" expande.
 */
export default function NextActionCard({
  title,
  why,
  ctaLabel,
  compact = false,
  busy = false,
  onPrimary,
  onSecondary,
  secondaryLabel,
}: NextActionCardProps) {
  return (
    <section
      aria-label="A seguir"
      style={{
        margin: '14px 20px 0',
        padding: compact ? '16px 18px' : '22px 20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
        border: '0.5px solid rgba(var(--ink-rgb),.08)',
        borderLeft: '2px solid var(--gold)',
        boxShadow: '0 20px 54px rgba(0,0,0,.24)',
      }}
    >
      <div style={{ display: 'grid', gap: compact ? 12 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 12, background: 'rgba(232,168,56,.12)', color: 'var(--gold)', border: '0.5px solid rgba(232,168,56,.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="zap" size={18} />
          </span>
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 12, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800 }}>
            A seguir
          </span>
        </div>

        <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: compact ? 19 : 23, lineHeight: 1.2, color: 'var(--text1)' }}>
          {title}
        </p>

        {!compact && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 9, background: 'rgba(30,203,180,.11)', color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="target" size={14} />
            </span>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>{why}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: onSecondary ? 'minmax(0, 1fr) auto' : '1fr', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            aria-busy={busy}
            style={{
              minHeight: 48,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              padding: '0 16px',
              border: 'none',
              background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
              color: 'var(--on-bright)',
              fontFamily: 'Syne, sans-serif',
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              touchAction: 'manipulation',
              boxShadow: '0 10px 24px rgba(232,168,56,.2)',
            }}
          >
            {ctaLabel}
          </button>
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              style={{
                minHeight: 48,
                border: 'none',
                background: 'transparent',
                color: 'var(--text2)',
                padding: '0 6px',
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontSize: 14,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {secondaryLabel ?? 'Ver hábitos'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
