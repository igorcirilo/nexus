import type { Question } from '@/types'

type Props = {
  question: Question
  value: string[]
  onChange: (val: string[]) => void
}

export function RankingQuestion({ question, value, onChange }: Props) {
  const MAX = 3

  const toggleArea = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else if (value.length < MAX) {
      onChange([...value, id])
    }
  }

  const rankOf = (id: string) => {
    const idx = value.indexOf(id)
    return idx >= 0 ? idx + 1 : null
  }

  return (
    <div>
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text1)',
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        {question.text}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Toque para selecionar em ordem de prioridade ({value.length}/{MAX})
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options?.map((opt) => {
          const rank = rankOf(opt.id)
          const selected = rank !== null
          const blocked = value.length >= MAX && !selected

          return (
            <button
              key={opt.id}
              onClick={() => toggleArea(opt.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: selected ? 'rgba(232,168,56,.08)' : 'var(--bg2)',
                border: selected ? '0.5px solid var(--gold)' : '0.5px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked ? 0.4 : 1,
                transition: 'all .2s ease',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: selected ? 'var(--gold)' : 'var(--bg3)',
                  color: selected ? 'var(--bg0)' : 'var(--text3)',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {rank ?? '·'}
              </span>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: selected ? 'var(--gold)' : 'var(--text1)', textAlign: 'left' }}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
