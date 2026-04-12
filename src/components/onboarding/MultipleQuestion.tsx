import type { Question } from '@/types'

type Props = {
  question: Question
  value: string[]
  onChange: (val: string[]) => void
}

function CheckIcon() {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

export function MultipleQuestion({ question, value, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div>
      <p
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text1)',
          marginBottom: 20,
          lineHeight: 1.2,
        }}
      >
        {question.text}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options?.map((opt) => {
          const selected = value.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: selected ? 'rgba(127,119,221,.10)' : 'var(--bg2)',
                border: selected ? '0.5px solid var(--accent)' : '0.5px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all .2s ease',
                gap: 12,
              }}
            >
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: selected ? 'var(--accent)' : 'var(--text1)', textAlign: 'left', flex: 1 }}>
                {opt.label}
              </span>
              {selected ? <CheckIcon /> : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '0.5px solid var(--border)', flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
