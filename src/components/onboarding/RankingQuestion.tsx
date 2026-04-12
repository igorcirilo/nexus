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
    <div className="flex flex-col gap-4">
      <p className="text-lg font-medium text-white">{question.text}</p>
      <p className="text-sm text-zinc-500">
        Toque para selecionar em ordem de prioridade ({value.length}/{MAX})
      </p>
      <div className="flex flex-col gap-2">
        {question.options?.map((opt) => {
          const rank = rankOf(opt.id)
          const selected = rank !== null

          return (
            <button
              key={opt.id}
              onClick={() => toggleArea(opt.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : value.length >= MAX
                    ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/30 text-zinc-500'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  selected ? 'bg-violet-500 text-white' : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {rank ?? '·'}
              </span>
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
