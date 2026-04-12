import type { Question, Answers } from '@/types'
import { ScaleQuestion } from './ScaleQuestion'
import { SingleQuestion } from './SingleQuestion'
import { MultipleQuestion } from './MultipleQuestion'
import { RankingQuestion } from './RankingQuestion'

type Props = {
  question: Question
  answer: Answers[string] | undefined
  onChange: (val: Answers[string]) => void
}

export function QuestionRenderer({ question, answer, onChange }: Props) {
  switch (question.type) {
    case 'scale':
      return <ScaleQuestion question={question} value={answer as number | undefined} onChange={onChange} />
    case 'single':
      return <SingleQuestion question={question} value={answer as string | undefined} onChange={onChange} />
    case 'multiple':
      return <MultipleQuestion question={question} value={(answer as string[] | undefined) ?? []} onChange={onChange} />
    case 'ranking':
      return <RankingQuestion question={question} value={(answer as string[] | undefined) ?? []} onChange={onChange} />
    default:
      return null
  }
}
