'use client'

import Icon, { type IconName } from '@/components/ui/Icon'
import type { Pendencia, PendenciaSeverity } from '@/lib/pendencias'

interface AttentionPanelProps {
  pendencias: Pendencia[]
}

const SEVERITY_STYLE: Record<PendenciaSeverity, { color: string; icon: IconName; bg: string; border: string }> = {
  risk: { color: 'var(--red, #E24B4A)', icon: 'flame', bg: 'rgba(226,75,74,.1)', border: 'rgba(226,75,74,.26)' },
  warn: { color: 'var(--gold)', icon: 'bell', bg: 'rgba(232,168,56,.1)', border: 'rgba(232,168,56,.26)' },
  info: { color: 'var(--teal)', icon: 'clock', bg: 'rgba(30,203,180,.1)', border: 'rgba(30,203,180,.24)' },
}

export default function AttentionPanel({ pendencias }: AttentionPanelProps) {
  if (pendencias.length === 0) return null

  return (
    <section
      aria-label="Atenção"
      style={{
        margin: '16px 20px 0',
        padding: '18px 20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
        border: '0.5px solid rgba(var(--ink-rgb),.08)',
        borderLeft: `2px solid ${SEVERITY_STYLE[pendencias[0].severity].color}`,
        boxShadow: '0 20px 54px rgba(0,0,0,.24)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 38, height: 38, borderRadius: 14, background: 'rgba(var(--ink-rgb),.05)', color: 'var(--text2)', border: '0.5px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="bell" size={20} />
        </span>
        <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800 }}>
          Atenção
        </span>
      </div>

      <ul style={{ listStyle: 'none', display: 'grid', gap: 8, margin: 0, padding: 0 }}>
        {pendencias.map((p) => {
          const s = SEVERITY_STYLE[p.severity]
          return (
            <li
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: s.bg, border: `0.5px solid ${s.border}` }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(var(--bg-rgb),.4)', color: s.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon} size={15} />
              </span>
              <p style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--text1)' }}>{p.message}</p>
              {p.ctaHref && p.ctaLabel && (
                <a
                  href={p.ctaHref}
                  style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: s.color, textDecoration: 'none', whiteSpace: 'nowrap', padding: '4px 2px' }}
                >
                  {p.ctaLabel} ›
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
