'use client'
// src/components/EmptyState.tsx
// Mostrado na Home quando o utilizador não tem hábitos nem missão

interface Props {
  hasHabits: boolean
  hasMission: boolean
  username: string
}

export default function EmptyState({ hasHabits, hasMission, username }: Props) {
  const steps = [
    {
      done: hasMission,
      icon: '🌅',
      title: 'Define a missão do dia',
      desc: 'Faz o check-in da manhã para definir o teu foco.',
      href: '/checkin',
      btn: 'Fazer check-in',
    },
    {
      done: hasHabits,
      icon: '✅',
      title: 'Adiciona os teus hábitos',
      desc: 'Cria pelo menos 3 hábitos para acompanhar diariamente.',
      href: '/habitos',
      btn: 'Ir para Hábitos',
    },
  ].filter(s => !s.done)

  if (steps.length === 0) return null

  return (
    <div style={{ margin: '12px 20px 0' }}>
      {/* Header do estado vazio */}
      <div style={{
        padding: '16px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(232,168,56,.08) 0%, rgba(127,119,221,.08) 100%)',
        border: '0.5px solid rgba(232,168,56,.2)',
        marginBottom: 10,
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 4 }}>
          Olá, {username} 👋
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          Faltam {steps.length} passo{steps.length > 1 ? 's' : ''} para activar o teu painel completo.
        </div>
      </div>

      {/* Steps */}
      {steps.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 14, marginBottom: 8,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
        }}>
          {/* Número */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(232,168,56,.1)', border: '0.5px solid rgba(232,168,56,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--gold)',
          }}>{i + 1}</div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 2 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.desc}</div>
          </div>

          {/* CTA */}
          <a href={s.href} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 10,
            background: 'var(--gold)', color: 'var(--bg0)',
            textDecoration: 'none', fontSize: 12,
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>{s.btn}</a>
        </div>
      ))}
    </div>
  )
}
