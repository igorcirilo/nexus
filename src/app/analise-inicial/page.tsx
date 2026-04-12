'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { calculateScores } from '@/lib/profile-assessment'
import { generateProgramFromAssessment } from '@/lib/assessment-to-program'
import type { AreaScores, HabitArea, Answers } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const AREA_LABELS: Record<HabitArea, string> = {
  corpo: 'Saúde e Corpo',
  produtividade: 'Produtividade',
  idiomas: 'Idiomas',
  carreira: 'Carreira',
  financas: 'Finanças',
  emocoes: 'Emoções',
  relacionamentos: 'Relacionamentos',
}

const AREA_COLORS: Record<HabitArea, string> = {
  corpo: 'bg-emerald-500',
  produtividade: 'bg-blue-500',
  idiomas: 'bg-yellow-500',
  carreira: 'bg-orange-500',
  financas: 'bg-green-600',
  emocoes: 'bg-pink-500',
  relacionamentos: 'bg-purple-500',
}

const AREAS: HabitArea[] = [
  'corpo', 'produtividade', 'idiomas', 'carreira',
  'financas', 'emocoes', 'relacionamentos',
]

export default function AnaliseInicialPage() {
  const router = useRouter()
  const [scores, setScores] = useState<AreaScores | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const assessmentId = sessionStorage.getItem('nexus_assessment_id')
    const answersRaw = sessionStorage.getItem('nexus_assessment_answers')

    if (!assessmentId || !answersRaw) {
      router.replace('/onboarding-v2')
      return
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/auth')
        return
      }
      setUserId(data.user.id)
      const answers = JSON.parse(answersRaw) as Answers
      setScores(calculateScores(answers))
    })
  }, [router])

  const handleGeneratePlan = async () => {
    if (!userId || !scores) return

    const assessmentId = sessionStorage.getItem('nexus_assessment_id')!
    const answersRaw = sessionStorage.getItem('nexus_assessment_answers')!
    const answers = JSON.parse(answersRaw) as Answers

    setGenerating(true)
    setError(null)

    try {
      await generateProgramFromAssessment(userId, assessmentId, answers)
      sessionStorage.removeItem('nexus_assessment_id')
      sessionStorage.removeItem('nexus_assessment_answers')
      router.push('/hoje')
    } catch (e) {
      setError('Erro ao gerar seu plano. Tente novamente.')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  if (!scores) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-zinc-950 px-4 py-8">
      <div className="mb-8 text-center">
        <p className="mb-1 text-sm text-zinc-400">Diagnóstico inicial</p>
        <h1 className="mb-1 text-4xl font-bold text-white">
          {scores.global}<span className="text-2xl text-zinc-400">/100</span>
        </h1>
        <p className="text-sm text-zinc-400">Sua pontuação inicial</p>
      </div>

      <div className="mb-8 flex flex-col gap-3">
        {AREAS.map((area) => (
          <div key={area} className="rounded-xl bg-zinc-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">{AREA_LABELS[area]}</span>
              <span className="text-sm font-bold text-white">{scores[area]}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${AREA_COLORS[area]}`}
                style={{ width: `${scores[area]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

      <button
        onClick={handleGeneratePlan}
        disabled={generating}
        className="w-full rounded-xl bg-violet-600 py-4 text-base font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating ? 'Gerando seu plano...' : 'Ver meu plano de 60 dias →'}
      </button>

      <p className="mt-3 text-center text-xs text-zinc-500">
        Vamos montar sua semana 1 personalizada com base no seu diagnóstico
      </p>
    </div>
  )
}
