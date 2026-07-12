import type { Question } from '@/types'

type Props = {
  question: Question
  value: string | undefined
  onChange: (val: string) => void
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

export function SingleQuestion({ question, value, onChange }: Props) {
  return (
    <div>
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text1)',
          marginBottom: 20,
          lineHeight: 1.2,
        }}
      >
        {question.text}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options?.map((opt) => {
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: selected ? 'rgba(127,119,221,.10)' : 'var(--bg2)',
                border: selected ? '0.5px solid var(--accent)' : '0.5px solid var(--border)',
                borderRadius: 14,
                padding: opt.icon ? '14px 16px' : '14px 16px',
                cursor: 'pointer',
                transition: 'all .2s ease',
                textAlign: 'left',
              }}
            >
              {opt.icon && (
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    background: selected ? 'rgba(127,119,221,.18)' : 'rgba(var(--ink-rgb),.05)',
                  }}
                >
                  {opt.icon}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'DM Sans, sans-serif', fontWeight: opt.hint ? 700 : 400, fontSize: opt.hint ? 15 : 14, color: selected ? 'var(--accent)' : 'var(--text1)' }}>
                  {opt.label}
                </span>
                {opt.hint && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{opt.hint}</span>
                )}
              </span>
              {selected ? <CheckIcon /> : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '0.5px solid var(--border)', flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
