'use client'

import type { DomainStat } from '@/lib/home-extras'

interface LifeGridProps {
  domains: DomainStat[]
}

/**
 * "A tua vida" (trabalho ORGANIZA, visão de todo o app): estado dos domínios
 * (Corpo, Finanças, Leitura…) num relance, com a área a precisar de atenção em
 * destaque. É o que torna a home condizente com o produto inteiro.
 */
export default function LifeGrid({ domains }: LifeGridProps) {
  if (domains.length === 0) return null

  return (
    <section aria-label="A tua vida" style={{ padding: '18px 20px 0' }}>
      <h2 style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text3)', marginBottom: 10, padding: '0 2px' }}>
        A tua vida
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {domains.map((d) => (
          <a
            key={d.key}
            href={d.href}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'rgba(var(--ink-rgb),.025)',
              border: `0.5px solid ${d.flag ? 'rgba(212,83,126,.35)' : 'var(--border)'}`,
              borderRadius: 16,
              padding: 13,
              textDecoration: 'none',
              color: 'inherit',
              overflow: 'hidden',
            }}
          >
            {d.flag && (
              <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 800, color: d.color, background: 'rgba(212,83,126,.14)', borderRadius: 7, padding: '2px 6px' }}>
                {d.flag}
              </span>
            )}
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, marginBottom: 2 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 15, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.value}
              {d.sub && <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text3)' }}> · {d.sub}</span>}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
