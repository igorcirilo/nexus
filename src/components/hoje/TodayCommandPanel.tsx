'use client'

import Icon from '@/components/ui/Icon'

interface TodayCommandPanelProps {
  action: string
  context: string
}

export default function TodayCommandPanel({ action, context }: TodayCommandPanelProps) {
  return (
    <section
      aria-label="Ação principal de hoje"
      style={{
        margin: '16px 20px 0',
        padding: '22px 20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(28,32,48,.98), rgba(14,22,31,.98))',
        border: '0.5px solid rgba(255,255,255,.08)',
        borderLeft: '2px solid var(--gold)',
        boxShadow: '0 20px 54px rgba(0,0,0,.24)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 14, background: 'rgba(232,168,56,.12)', color: 'var(--gold)', border: '0.5px solid rgba(232,168,56,.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="zap" size={20} />
          </span>
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 12, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800 }}>
            Agora
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 16 }}>
          <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 24, lineHeight: 1.18, color: 'var(--text1)', letterSpacing: 0 }}>
            {action}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 74, height: 74, borderRadius: 22, background: 'linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.03))', color: 'var(--gold)', border: '0.5px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)' }}>
              <NotePencilIcon />
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingTop: 2 }}>
          <span style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(30,203,180,.11)', color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="target" size={15} />
          </span>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>
            {context}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
          <a
            href="/checkin"
            style={{
              minHeight: 48,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              padding: '0 16px',
              background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
              color: 'var(--bg0)',
              textDecoration: 'none',
              fontFamily: 'Syne, sans-serif',
              fontSize: 14,
              fontWeight: 800,
              touchAction: 'manipulation',
              boxShadow: '0 10px 24px rgba(232,168,56,.2)',
            }}
          >
            Ir para o check-in
          </a>
          <button
            type="button"
            onClick={() => document.getElementById('tarefas-hoje')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
            Depois
          </button>
        </div>
      </div>
    </section>
  )
}

function NotePencilIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <path d="M10.5 7.5h14.75a4 4 0 0 1 4 4v7.25" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 7.5a4 4 0 0 0-4 4v20a2 2 0 0 0 2 2h13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 15h11M14 21h10M14 27h7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M27.5 31.5 20 33l1.5-7.5 8.75-8.75a3.2 3.2 0 0 1 4.5 4.5L27.5 31.5Z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m27.75 18.75 4.5 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
