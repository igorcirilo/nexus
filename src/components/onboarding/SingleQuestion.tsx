import type { Question } from '@/types'

type Props = {
  question: Question
  value: string | undefined
  onChange: (val: string) => void
}

export function SingleQuestion({ question, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-medium text-white">{question.text}</p>
      <div className="flex flex-col gap-2">
        {question.options?.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
              value === opt.id
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
