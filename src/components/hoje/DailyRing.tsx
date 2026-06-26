'use client'

import Icon from '@/components/ui/Icon'

interface DailyRingProps {
  done: number
  total: number
  streak: number
}

/**
 * Âncora da home: o anel diário de hábitos num relance. Apenas leitura — a
 * execução vive na lista. Funde a contagem de hábitos e a sequência num só
 * sinal (anti-redundância) e leva ao progresso ao toque.
 */
export default function DailyRing({ done, total, streak }: DailyRingProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const radius = 34
  const circ = 2 * Math.PI * radius
  const dash = (Math.min(100, pct) / 100) * circ
  const complete = total > 0 && done >= total

  return (
    <a
      href="/progresso"
      aria-label={`Hábitos de hoje: ${done} de ${total} concluídos. Sequência de ${streak} dias. Ver progresso.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        margin: '18px 20px 0',
        padding: '16px 18px',
        borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
        border: '0.5px solid var(--border)',
        boxShadow: '0 14px 40px rgba(0,0,0,.16)',
        textDecoration: 'none',
        color: 'inherit',
        touchAction: 'manipulation',
      }}
    >
      <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={complete ? 'var(--teal)' : 'var(--gold)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 42 42)"
            style={{ transition: 'stroke-dasharray .7s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {complete ? (
            <Icon name="check" size={26} color="var(--teal)" />
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 22, lineHeight: 1, color: 'var(--text1)' }}>
                {done}
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>/{total}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: 'var(--text1)', marginBottom: 6 }}>
          {complete ? 'Anel do dia fechado' : 'Hábitos de hoje'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
          <Icon name="flame" size={16} color="var(--gold)" />
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, color: 'var(--gold)' }}>{streak}</span>
          <span>{streak === 1 ? 'dia de sequência' : 'dias de sequência'}</span>
        </div>
      </div>

      <Icon name="chevron-right" size={18} color="var(--text3)" />
    </a>
  )
}
