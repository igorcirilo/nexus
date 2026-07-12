import type { Question } from '@/types'

type Props = {
  question: Question
  value: number | undefined
  onChange: (val: number) => void
}

export function ScaleQuestion({ question, value, onChange }: Props) {
  const min = question.min ?? 1
  const max = question.max ?? 5
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min)

  const labels: Record<number, string> = {
    [min]: question.invert ? 'Muito baixo' : 'Muito ruim',
    [max]: question.invert ? 'Muito alto' : 'Excelente',
  }

  return (
    <div>
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text1)',
          marginBottom: 28,
          lineHeight: 1.2,
        }}
      >
        {question.text}
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {steps.map((step) => {
          const selected = value === step
          return (
            <button
              key={step}
              onClick={() => onChange(step)}
              style={{
                width: 52,
                height: 52,
                background: selected ? 'rgba(127,119,221,.12)' : 'var(--bg2)',
                border: selected ? '0.5px solid var(--accent)' : '0.5px solid var(--border)',
                borderRadius: 12,
                color: selected ? 'var(--accent)' : 'var(--text2)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                cursor: 'pointer',
                transition: 'all .2s ease',
              }}
            >
              {step}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
        <span>{labels[min]}</span>
        <span>{labels[max]}</span>
      </div>
    </div>
  )
}
