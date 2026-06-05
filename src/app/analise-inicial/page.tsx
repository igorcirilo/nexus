'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { calculateScores } from '@/lib/profile-assessment'
import { generateProgramFromAssessment } from '@/lib/assessment-to-program'
import type { AreaScores, HabitArea, Answers } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg0)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--gold)',
            borderTopColor: 'transparent',
            animation: 'spin .8s linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: '28px 20px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <span className="chip chip-accent">Diagnóstico inicial</span>
        <div
          style={{
            margin: '20px 0 4px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 64,
            color: 'var(--gold)',
            lineHeight: 1,
          }}
        >
          {scores.global}
          <span style={{ fontSize: 24, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>Sua pontuação inicial</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {AREAS.map(area => (
          <div key={area} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif' }}>{AREA_LABELS[area]}</span>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>{scores[area]}</span>
            </div>
            <div style={{ background: 'var(--bg3)', height: 4, borderRadius: 100, overflow: 'hidden' }}>
              <div
                style={{
                  background: 'var(--teal)',
                  width: `${scores[area]}%`,
                  borderRadius: 100,
                  height: '100%',
                  transition: 'width .6s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p style={{ marginBottom: 12, fontSize: 13, color: '#E24B4A' }}>{error}</p>}
      <button
        className="btn-primary"
        onClick={handleGeneratePlan}
        disabled={generating}
        style={{ opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
      >
        {generating ? 'Gerando seu plano...' : 'Ver meu plano de 63 dias →'}
      </button>
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
        Vamos montar seu plano de 63 dias personalizado com base no seu diagnóstico
      </p>
    </div>
  )
}
