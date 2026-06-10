'use client'

import Icon from '@/components/ui/Icon'

interface WeeklyChallengeStripProps {
  title: string
  done: number
  total: number
  open: boolean
  onToggle: () => void
  onSwap: () => void
}

export default function WeeklyChallengeStrip({ title, done, total, open, onToggle, onSwap }: WeeklyChallengeStripProps) {
  const pct = Math.round((done / Math.max(1, total)) * 100)

  return (
    <section style={{ margin: '12px 20px 0', padding: 14, borderRadius: 18, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: '100%',
          minHeight: 44,
          border: 'none',
          background: 'transparent',
          color: 'var(--text1)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
          touchAction: 'manipulation',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(30,203,180,.1)', color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="trophy" size={18} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 3 }}>
              Desafio da semana
            </span>
            <span style={{ display: 'block', fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 500, fontSize: 12, color: 'var(--text2)' }}>
            {done}/{total}
          </span>
          <Icon name="chevron-right" size={17} color="var(--text3)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
        </span>
      </button>
      <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5, marginTop: 8 }}>
        <div style={{ height: '100%', borderRadius: 100, background: 'var(--teal)', width: `${pct}%`, transition: 'width .25s ease' }} />
      </div>
      {open && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text3)' }}>
            Progresso visível sem competir com a ação principal do dia.
          </p>
          <button
            type="button"
            onClick={onSwap}
            style={{
              minHeight: 44,
              border: '0.5px solid rgba(127,119,221,.28)',
              borderRadius: 12,
              background: 'rgba(127,119,221,.08)',
              color: 'var(--accent)',
              padding: '0 14px',
              fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              touchAction: 'manipulation',
              flexShrink: 0,
            }}
          >
            Trocar
          </button>
        </div>
      )}
    </section>
  )
}
