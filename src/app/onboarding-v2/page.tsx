'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ONBOARDING_QUESTIONS, saveDraft, loadDraft, submitAssessment } from '@/lib/onboarding-engine'
import { QuestionRenderer } from '@/components/onboarding/QuestionRenderer'
import { ProgressBar } from '@/components/onboarding/ProgressBar'
import type { Answers } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TOTAL = ONBOARDING_QUESTIONS.length

export default function OnboardingV2Page() {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/auth')
        return
      }
      setUserId(data.user.id)
    })

    const draft = loadDraft()
    if (Object.keys(draft).length > 0) {
      setAnswers(draft)
    }
  }, [router])

  const currentQuestion = ONBOARDING_QUESTIONS[currentIndex]
  const currentAnswer = answers[currentQuestion.id]

  const isAnswered = useCallback(() => {
    const ans = answers[currentQuestion.id]
    if (currentQuestion.type === 'multiple') return true
    if (currentQuestion.type === 'ranking') return Array.isArray(ans) && ans.length >= 1
    return ans !== undefined && ans !== null && ans !== ''
  }, [answers, currentQuestion])

  const handleChange = (val: Answers[string]) => {
    const updated = { ...answers, [currentQuestion.id]: val }
    setAnswers(updated)
    saveDraft(updated)
  }

  const handleNext = async () => {
    if (!isAnswered()) return

    if (currentIndex < TOTAL - 1) {
      setCurrentIndex((i) => i + 1)
      return
    }

    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const finalAnswers = answers as Answers
      const assessmentId = await submitAssessment(userId, finalAnswers)
      sessionStorage.setItem('nexus_assessment_id', assessmentId)
      sessionStorage.setItem('nexus_assessment_answers', JSON.stringify(finalAnswers))
      router.push('/analise-inicial')
    } catch (e) {
      setError('Erro ao salvar suas respostas. Tente novamente.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <div className="px-4 pb-4 pt-6">
        <ProgressBar current={currentIndex + 1} total={TOTAL} />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-violet-400">
          Bloco {currentQuestion.block} de 8
        </div>
        <QuestionRenderer
          question={currentQuestion}
          answer={currentAnswer}
          onChange={handleChange}
        />
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>

      <div className="mx-auto flex w-full max-w-lg gap-3 px-4 pb-8">
        {currentIndex > 0 && (
          <button
            onClick={handleBack}
            className="flex-1 rounded-xl border border-zinc-700 py-3 font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Voltar
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!isAnswered() || loading}
          className="flex-1 rounded-xl bg-violet-600 py-3 font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading
            ? 'Salvando...'
            : currentIndex === TOTAL - 1
              ? 'Ver meu diagnóstico'
              : 'Próxima'}
        </button>
      </div>
    </div>
  )
}
