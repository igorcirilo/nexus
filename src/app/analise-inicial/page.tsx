'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateScores } from '@/lib/profile-assessment'
import {
  generateHabitsFromAssessment,
  suggestHabitLevel,
  selectHabitsForLevel,
  HABIT_LEVELS,
  type HabitLevel,
} from '@/lib/assessment-to-habits'
import { logError } from '@/lib/log'
import type { AreaScores, HabitArea, Answers } from '@/types'

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
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [suggestedLevel, setSuggestedLevel] = useState<HabitLevel>(1)
  const [selectedLevel, setSelectedLevel] = useState<HabitLevel>(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const assessmentId = sessionStorage.getItem('nexus_assessment_id')
    const answersRaw = sessionStorage.getItem('nexus_assessment_answers')

    if (!assessmentId || !answersRaw) {
      router.replace('/onboarding-v2')
      return
    }

    // getSession() lê a sessão local (cookies) sem round-trip de rede — evita o
    // falso "deslogado" que mandava para /auth a meio do onboarding.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/auth')
        return
      }
      setUserId(session.user.id)
      const parsed = JSON.parse(answersRaw) as Answers
      const sc = calculateScores(parsed)
      const suggested = suggestHabitLevel(parsed, sc)
      setAnswers(parsed)
      setScores(sc)
      setSuggestedLevel(suggested)
      setSelectedLevel(suggested)
    })
  }, [router])

  const handleGeneratePlan = async () => {
    if (!userId || !scores || !answers) return

    const assessmentId = sessionStorage.getItem('nexus_assessment_id')!

    setGenerating(true)
    setError(null)

    try {
      await generateHabitsFromAssessment(userId, assessmentId, answers, selectedLevel)
      sessionStorage.removeItem('nexus_assessment_id')
      sessionStorage.removeItem('nexus_assessment_answers')
      router.push('/hoje')
    } catch (e) {
      setError('Erro ao criar seus hábitos. Tente novamente.')
      logError('analise-inicial: gerar hábitos', e)
    } finally {
      setGenerating(false)
    }
  }

  if (!scores || !answers) {
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

  const preview = selectHabitsForLevel(answers, scores, selectedLevel)

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: '28px 20px calc(28px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <span className="chip chip-accent">Diagnóstico inicial</span>
        <div
          style={{
            margin: '20px 0 4px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: 64,
            color: 'var(--gold)',
            lineHeight: 1,
          }}
        >
          {scores.global}
          <span style={{ fontSize: 24, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Sua pontuação inicial</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {AREAS.map(area => (
          <div key={area} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif' }}>{AREA_LABELS[area]}</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>{scores[area]}</span>
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

      {/* Seletor de nível */}
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text1)', marginBottom: 4 }}>
        Escolha sua intensidade
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        Começar pequeno cria consistência. Você pode subir de nível depois.
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {HABIT_LEVELS.map(spec => {
          const active = spec.level === selectedLevel
          const isSuggested = spec.level === suggestedLevel
          const parts = [
            spec.mix.d1 ? `${spec.mix.d1} fáceis` : null,
            spec.mix.d2 ? `${spec.mix.d2} médios` : null,
            spec.mix.d3 ? `${spec.mix.d3} difíceis` : null,
          ].filter(Boolean).join(' · ')
          return (
            <button
              key={spec.level}
              type="button"
              onClick={() => setSelectedLevel(spec.level)}
              aria-pressed={active}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 16,
                cursor: 'pointer',
                background: active ? 'rgba(232,168,56,.10)' : 'var(--bg2)',
                border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                touchAction: 'manipulation',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>
                    Nível {spec.level} · {spec.label}
                  </span>
                  {isSuggested && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-bright)', background: 'var(--gold)', borderRadius: 100, padding: '2px 7px' }}>
                      Sugerido
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{spec.total} hábitos · {parts}</span>
              </div>
              <span
                aria-hidden="true"
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${active ? 'var(--gold)' : 'var(--text3)'}`,
                  background: active ? 'var(--gold)' : 'transparent',
                }}
              />
            </button>
          )
        })}
      </div>

      {/* Preview dos hábitos do nível escolhido */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 10 }}>
          Seus {preview.length} hábitos
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {preview.map(h => (
            <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text1)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{h.name}</span>
              {h.time_window && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{h.time_window}</span>}
            </div>
          ))}
        </div>
      </div>

      {error && <p style={{ marginBottom: 12, fontSize: 13, color: '#E24B4A' }}>{error}</p>}
      <button
        className="btn-primary"
        onClick={handleGeneratePlan}
        disabled={generating}
        style={{ opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
      >
        {generating ? 'Criando seus hábitos...' : 'Criar meus hábitos →'}
      </button>
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
        Vamos montar seus hábitos diários com base no seu diagnóstico
      </p>
    </div>
  )
}
