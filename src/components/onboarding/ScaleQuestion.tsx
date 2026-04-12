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
  const middle = Math.round((min + max) / 2)

  const labels: Record<number, string> = {
    [min]: 'Muito ruim',
    [middle]: 'Regular',
    [max]: 'Excelente',
  }

  if (question.invert) {
    labels[min] = 'Muito baixo'
    labels[max] = 'Muito alto'
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-medium text-white">{question.text}</p>
      <div className="flex justify-center gap-2">
        {steps.map((step) => (
          <button
            key={step}
            onClick={() => onChange(step)}
            className={`h-12 w-12 rounded-xl font-bold text-base transition-all ${
              value === step
                ? 'scale-110 bg-violet-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {step}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1 text-xs text-zinc-500">
        <span>{labels[min]}</span>
        {labels[middle] && <span>{labels[middle]}</span>}
        <span>{labels[max]}</span>
      </div>
    </div>
  )
}
