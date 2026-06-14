'use client'
// src/components/NightSummaryCard.tsx

interface NightSummaryCardProps {
  ritmo: number
  habitsFeitos: number
  habitsTotal: number
  streak: number
  onVerProgresso: () => void
}

export default function NightSummaryCard({
  ritmo,
  habitsFeitos,
  habitsTotal,
  streak,
  onVerProgresso,
}: NightSummaryCardProps) {
  const ratio = habitsTotal > 0 ? Math.min(100, Math.round((habitsFeitos / habitsTotal) * 100)) : 0

  let message = 'Estás a construir o hábito. Continua amanhã.'
  if (streak >= 14) message = 'Imparável. Isto já é parte de ti.'
  else if (streak >= 7) message = 'Uma semana completa. Impressionante.'
  else if (streak >= 3) message = 'Boa sequência. Não quebres agora.'

  return (
    <section
      style={{
        margin: '14px 20px 0',
        background: 'var(--bg2)',
        border: '1px solid rgba(232,168,56,.28)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700, marginBottom: 6 }}>
            Resumo do dia
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--gold)', lineHeight: 1 }}>
            {ritmo}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>ritmo atual</div>
        </div>
        <div
          style={{
            minWidth: 84,
            background: 'rgba(232,168,56,.08)',
            border: '0.5px solid rgba(232,168,56,.22)',
            borderRadius: 12,
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>{streak}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>streak</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: 'var(--text2)' }}>Hábitos feitos</span>
          <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{habitsFeitos} de {habitsTotal}</span>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 7, overflow: 'hidden' }}>
          <div style={{ width: `${ratio}%`, height: '100%', borderRadius: 100, background: 'linear-gradient(90deg, var(--teal), rgba(30,203,180,.65))' }} />
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text2)',
          lineHeight: 1.6,
          background: 'rgba(255,255,255,.02)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 14,
        }}
      >
        {message}
      </div>

      <button
        type="button"
        onClick={onVerProgresso}
        style={{
          width: '100%',
          background: 'var(--gold)',
          color: 'var(--bg0)',
          border: 'none',
          borderRadius: 12,
          padding: '12px 14px',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Ver Progresso →
      </button>
    </section>
  )
}
