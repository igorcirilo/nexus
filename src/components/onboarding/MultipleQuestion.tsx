import type { Question } from '@/types'

type Props = {
  question: Question
  value: string[]
  onChange: (val: string[]) => void
}

export function MultipleQuestion({ question, value, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-medium text-white">{question.text}</p>
      <p className="text-sm text-zinc-500">Selecione todas que se aplicam</p>
      <div className="flex flex-col gap-2">
        {question.options?.map((opt) => {
          const selected = value.includes(opt.id)

          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  selected ? 'border-violet-500 bg-violet-500' : 'border-zinc-600'
                }`}
              >
                {selected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
