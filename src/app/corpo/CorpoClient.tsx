'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import WorkoutTracker from '@/components/corpo/WorkoutTracker'
import DietTracker from '@/components/corpo/DietTracker'
import WeightLog from '@/components/corpo/WeightLog'
import BodyHub from '@/components/corpo/BodyHub'
import Icon, { type IconName } from '@/components/ui/Icon'
import { todayISO } from '@/lib/date'
import type { TrainingPlan, DietPlan, Profile } from '@/types'

type BodyTab = 'resumo' | 'treino' | 'dieta' | 'peso'

const TABS: { key: BodyTab; label: string; icon: IconName }[] = [
  { key: 'resumo', label: 'Resumo', icon: 'list' },
  { key: 'treino', label: 'Treino', icon: 'dumbbell' },
  { key: 'dieta',  label: 'Dieta',  icon: 'salad' },
  { key: 'peso',   label: 'Peso',   icon: 'scale' },
]

interface CorpoClientProps {
  userId: string
  initialProfile: Profile | null
  initialTrainingPlans: TrainingPlan[]
  initialDietPlans: DietPlan[]
}

export default function CorpoClient({ userId, initialProfile, initialTrainingPlans, initialDietPlans }: CorpoClientProps) {
  const [tab, setTab] = useState<BodyTab>('resumo')
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  // Data local do dispositivo (correta para o utilizador, independente do fuso do servidor).
  const today = todayISO()

  // Resumo: tela full-bleed fiel ao mockup (sem h1/tab bar; navegação pelos cards + bottom nav)
  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
        <BodyHub
          userId={userId}
          today={today}
          trainingPlans={initialTrainingPlans}
          dietPlans={initialDietPlans}
          onNavigate={setTab}
        />
        <Nav />
      </main>
    )
  }

  // Sub-páginas: chrome padrão (título + barra de abas, incluindo "Resumo" para voltar)
  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 16 }}>
          Corpo
        </h1>

        {/* Tab bar */}
        <div style={{
          display: 'flex', background: 'var(--bg2)', borderRadius: 14,
          padding: 4, gap: 3, border: '0.5px solid var(--border)', marginBottom: 20,
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, minHeight: 54, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: tab === t.key ? 'var(--bg1)' : 'transparent',
              color: tab === t.key ? 'var(--gold)' : 'var(--text3)',
              transition: 'all .15s', fontSize: 9,
              fontFamily: 'Syne, sans-serif', fontWeight: tab === t.key ? 600 : 400,
              touchAction: 'manipulation',
            }}>
              <Icon name={t.icon} size={17} color="currentColor" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'treino' && (
          <WorkoutTracker
            userId={userId}
            today={today}
            initialPlans={initialTrainingPlans}
          />
        )}
        {tab === 'dieta' && (
          <DietTracker
            userId={userId}
            today={today}
            initialPlans={initialDietPlans}
          />
        )}
        {tab === 'peso' && (
          <WeightLog
            userId={userId}
            heightCm={profile?.height_cm ?? null}
            onHeightSave={cm => setProfile(p => p ? { ...p, height_cm: cm } : p)}
          />
        )}
      </div>

      <Nav />
    </main>
  )
}
