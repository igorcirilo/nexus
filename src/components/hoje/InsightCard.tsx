'use client'

import Icon from '@/components/ui/Icon'

interface InsightCardProps {
  title: string
  body: string
}

/**
 * "O Nexus reparou" (trabalho ENSINA): uma observação sobre um padrão real dos
 * teus dados. Determinística — ver lib/insight; só aparece quando há sinal.
 */
export default function InsightCard({ title, body }: InsightCardProps) {
  return (
    <section aria-label="O Nexus reparou" style={{ padding: '18px 20px 0' }}>
      <h2 style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text3)', marginBottom: 10, padding: '0 2px' }}>
        O Nexus reparou
      </h2>
      <div
        style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'linear-gradient(150deg, rgba(127,119,221,.12), rgba(var(--card-rgb),.3))', border: '0.5px solid rgba(127,119,221,.22)', borderRadius: 18, padding: '14px 15px' }}
      >
        <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(127,119,221,.16)', color: '#7F77DD', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="trend-up" size={17} />
        </span>
        <div>
          <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 13.5, lineHeight: 1.3, color: 'var(--text1)' }}>{title}</p>
          <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.4, marginTop: 3 }}>{body}</p>
        </div>
      </div>
    </section>
  )
}
