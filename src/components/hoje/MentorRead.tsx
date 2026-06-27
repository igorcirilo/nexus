'use client'

interface MentorReadProps {
  text: string
}

/**
 * A "leitura do dia" do mentor (trabalho ORIENTA): uma frase que mostra que o
 * assistente já leu o teu estado. Determinística — ver lib/mentor-read.
 */
export default function MentorRead({ text }: MentorReadProps) {
  return (
    <section
      aria-label="Leitura do dia"
      style={{
        margin: '14px 20px 0',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        background: 'linear-gradient(150deg, rgba(232,168,56,.10), rgba(var(--card-rgb),.35))',
        border: '0.5px solid rgba(232,168,56,.20)',
        borderRadius: 20,
        padding: '15px 16px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          flexShrink: 0,
          background: 'linear-gradient(140deg, var(--gold), #b6781f)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          color: 'var(--on-bright)',
          fontSize: 17,
        }}
      >
        N
      </span>
      <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 600, fontSize: 14.5, lineHeight: 1.42, color: 'var(--text1)' }}>
        {text}
      </p>
    </section>
  )
}
