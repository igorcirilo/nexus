'use client'

interface Goal90CardProps {
  title: string
  progress: number
}

/**
 * Objetivo dos 90 dias em destaque (trabalho ORGANIZA, horizonte longo): liga a
 * rotina diária à meta maior. Determinístico — dados de goals_90.
 */
export default function Goal90Card({ title, progress }: Goal90CardProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  return (
    <section aria-label="Objetivo dos 90 dias" style={{ padding: '18px 20px 0' }}>
      <h2 style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text3)', marginBottom: 10, padding: '0 2px' }}>
        Objetivo dos 90 dias
      </h2>
      <a
        href="/objetivos"
        style={{ display: 'flex', gap: 13, alignItems: 'center', background: 'rgba(var(--ink-rgb),.025)', border: '0.5px solid var(--border)', borderRadius: 16, padding: 14, textDecoration: 'none', color: 'inherit' }}
      >
        <span style={{ width: 3, alignSelf: 'stretch', minHeight: 34, borderRadius: 3, background: 'var(--gold)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 14.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <div style={{ height: 6, borderRadius: 6, background: 'rgba(var(--ink-rgb),.08)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 6, transition: 'width .6s ease' }} />
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text2)', flexShrink: 0 }}>{pct}%</span>
      </a>
    </section>
  )
}
