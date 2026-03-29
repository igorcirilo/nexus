'use client'
// src/components/StreakRecovery.tsx
// Aparece quando streak = 0 mas há histórico anterior

interface Props {
  prevBest: number
  onDismiss: () => void
  onCheckin: () => void
}

export default function StreakRecovery({ prevBest, onDismiss, onCheckin }: Props) {
  return (
    <div style={{
      margin: '12px 20px 0',
      padding: '18px 16px',
      borderRadius: 18,
      background: 'var(--bg2)',
      border: '0.5px solid rgba(232,168,56,.25)',
      position: 'relative',
    }}>
      {/* Fechar */}
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 26, height: 26, borderRadius: 8,
          background: 'var(--bg3)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text3)', fontSize: 14, lineHeight: 1,
        }}>
        ×
      </button>

      {/* Emoji grande */}
      <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>

      {/* Título */}
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text1)', marginBottom: 8, lineHeight: 1.3 }}>
        Ontem não aconteceu.<br />Hoje é o Dia 1.
      </div>

      {/* Mensagem */}
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
        O teu melhor streak foi de <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{prevBest} dias</span>.
        {' '}Isso não desapareceu — está guardado em ti.
        A consistência não é perfeição, é a capacidade de recomeçar.
      </p>

      {/* Separador */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

      {/* Acção */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Próximo passo — uma acção, agora:
      </div>
      <button
        onClick={onCheckin}
        style={{
          width: '100%', background: 'var(--gold)', color: 'var(--bg0)',
          border: 'none', borderRadius: 12, padding: '12px',
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', transition: 'all .15s',
        }}>
        Fazer o check-in da manhã →
      </button>
    </div>
  )
}
