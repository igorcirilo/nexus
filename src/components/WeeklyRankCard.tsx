'use client'
// src/components/WeeklyRankCard.tsx

type WeeklyRankCardProps = {
  xpActual: number
  xpAnterior: number
  diff: number
}

export default function WeeklyRankCard({ xpActual, xpAnterior, diff }: WeeklyRankCardProps) {
  const positive = diff > 0
  const negative = diff < 0
  const arrow = positive ? '↑' : negative ? '↓' : '→'
  const tone = positive ? 'var(--teal)' : negative ? '#E24B4A' : 'var(--text3)'

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--gold)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            Ranking semanal pessoal
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--gold)' }}>
            {xpActual} XP
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Esta semana</div>
        </div>

        <div
          style={{
            minWidth: 88,
            textAlign: 'right',
            color: tone,
          }}
        >
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26 }}>
            {arrow} {Math.abs(diff)}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            vs semana passada
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div
          style={{
            background: 'var(--bg3)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Esta semana</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>
            {xpActual} XP
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg3)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Semana passada</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>
            {xpAnterior} XP
          </div>
        </div>
      </div>
    </div>
  )
}
