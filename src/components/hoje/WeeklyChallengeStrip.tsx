'use client'

import Icon from '@/components/ui/Icon'

interface WeeklyChallengeStripProps {
  theme: string
  weekNumber: number
  totalWeeks: number
  done: number
  total: number
  open: boolean
  onToggle: () => void
}

export default function WeeklyChallengeStrip({ theme, weekNumber, totalWeeks, done, total, open, onToggle }: WeeklyChallengeStripProps) {
  const pct = Math.round((done / Math.max(1, total)) * 100)
  const title = `Semana ${weekNumber}${theme ? ` · ${theme}` : ''}`

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
              Foco da semana
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
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text3)' }}>
            {theme
              ? `O programa periodiza o teu progresso. Esta é a semana ${weekNumber} de ${totalWeeks} — tema "${theme}". Conclui as tarefas do dia para avançares.`
              : `Semana ${weekNumber} de ${totalWeeks} do teu programa. Conclui as tarefas do dia para avançares.`}
          </p>
        </div>
      )}
    </section>
  )
}
