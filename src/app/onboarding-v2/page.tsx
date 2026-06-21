'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ONBOARDING_QUESTIONS, saveDraft, loadDraft, submitAssessment } from '@/lib/onboarding-engine'
import { QuestionRenderer } from '@/components/onboarding/QuestionRenderer'
import { ProgressBar } from '@/components/onboarding/ProgressBar'
import { logError } from '@/lib/log'
import type { Answers } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
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
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/auth')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded, onboarding_version, program_id, habit_level')
        .eq('id', data.user.id)
        .single()

      // Já concluiu: tem hábitos por nível (novo) ou um programa (legado).
      if (profile?.onboarded && (profile.habit_level != null || profile.program_id)) {
        router.replace('/hoje')
        return
      }

      setUserId(data.user.id)
    }

    loadUser()
    const draft = loadDraft()
    if (Object.keys(draft).length > 0) setAnswers(draft)
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
      setCurrentIndex(i => i + 1)
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
      logError('onboarding-v2: submeter assessment', e)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg0)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <ProgressBar current={currentIndex + 1} total={TOTAL} />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '24px 20px',
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Bloco {currentQuestion.block} de 8
        </div>
        <QuestionRenderer question={currentQuestion} answer={currentAnswer} onChange={handleChange} />
        {error && <p style={{ marginTop: 16, fontSize: 13, color: '#E24B4A' }}>{error}</p>}
      </div>

      <div
        style={{
          padding: '16px 20px 28px',
          display: 'flex',
          gap: 10,
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
          background: 'var(--bg0)',
        }}
      >
        {currentIndex > 0 && (
          <button className="btn-ghost" style={{ flex: 1 }} onClick={handleBack}>
            Voltar
          </button>
        )}
        <button
          className="btn-primary"
          style={{ flex: 1, opacity: (!isAnswered() || loading) ? 0.4 : 1, cursor: (!isAnswered() || loading) ? 'not-allowed' : 'pointer' }}
          onClick={handleNext}
          disabled={!isAnswered() || loading}
        >
          {loading ? 'Salvando...' : currentIndex === TOTAL - 1 ? 'Ver meu diagnostico' : 'Proxima ->'}
        </button>
      </div>
    </div>
  )
}
