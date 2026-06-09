'use client'

import { useEffect, useState } from 'react'
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import Icon from '@/components/ui/Icon'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { getProfile } from '@/lib/supabase'
import { getTrainingEntriesForRange, getWeightLogs, type WeightLog } from '@/lib/body'
import type { TrainingEntry, TrainingPlan } from '@/types'

interface BodyHeroSectionProps {
  userId: string
  today: string
  trainingPlans: TrainingPlan[]
}

type HeroState = {
  weights: WeightLog[]
  weekEntries: TrainingEntry[]
  recentEntries: TrainingEntry[]
  workoutGoal: number | null
}

function formatDate(date: string) {
  return format(new Date(`${date}T12:00:00`), "d 'de' MMM", { locale: pt })
}

export default function BodyHeroSection({ userId, today, trainingPlans }: BodyHeroSectionProps) {
  const [state, setState] = useState<HeroState | null>(null)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      const date = new Date(`${today}T12:00:00`)
      const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const recentStart = format(subDays(date, 60), 'yyyy-MM-dd')

      const [weights, weekEntries, recentEntries, profile] = await Promise.all([
        getWeightLogs(userId, 90),
        getTrainingEntriesForRange(userId, weekStart, weekEnd),
        getTrainingEntriesForRange(userId, recentStart, today),
        getProfile(userId),
      ])

      if (!active) return
      setState({
        weights,
        weekEntries: weekEntries.filter(entry => entry.completed),
        recentEntries: recentEntries.filter(entry => entry.completed),
        workoutGoal: profile?.workouts_per_week ?? null,
      })
    }

    loadSummary()
    return () => {
      active = false
    }
  }, [today, userId])

  if (!state) {
    return <SkeletonCard height={156} />
  }

  const latestWeight = state.weights[state.weights.length - 1] ?? null
  const previousWeight = state.weights[state.weights.length - 2] ?? null
  const delta = latestWeight && previousWeight
    ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg)
    : null
  const trendIcon = delta !== null && delta > 0 ? 'trend-up' : 'trend-down'
  const trendColor = delta === null ? 'var(--text3)' : delta > 0 ? 'var(--gold)' : 'var(--teal)'
  const workoutGoal = state.workoutGoal ?? 3
  const weeklyDone = state.weekEntries.length
  const weeklyPct = Math.min(100, Math.round((weeklyDone / Math.max(1, workoutGoal)) * 100))
  const latestTraining = state.recentEntries[0] ?? null
  const latestRecord =
    latestTraining && (!latestWeight || latestTraining.date >= latestWeight.date)
      ? { label: 'Treino concluído', value: formatDate(latestTraining.date), icon: 'dumbbell' as const }
      : latestWeight
        ? { label: 'Peso registado', value: formatDate(latestWeight.date), icon: 'scale' as const }
        : null

  return (
    <section
      aria-label="Resumo corporal"
      style={{
        background: 'var(--bg2)',
        border: '0.5px solid rgba(30,203,180,.22)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
        boxShadow: '0 16px 40px rgba(0,0,0,.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginBottom: 3 }}>
            Resumo corporal
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: 'var(--text1)', lineHeight: 1 }}>
              {latestWeight ? Number(latestWeight.weight_kg).toFixed(1) : '--'}
            </span>
            <span style={{ color: 'var(--text3)', fontSize: 'var(--text-base)' }}>kg</span>
          </div>
        </div>

        <div
          style={{
            minWidth: 88,
            minHeight: 44,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg3)',
            border: '0.5px solid var(--border)',
            padding: 'var(--space-2) var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: trendColor,
          }}
        >
          <Icon name={trendIcon} size={17} />
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 'var(--text-base)', fontWeight: 700, lineHeight: 1 }}>
              {delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginTop: 2 }}>vs. anterior</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        <HeroMetric
          icon="dumbbell"
          label="Treinos na semana"
          value={`${weeklyDone}/${workoutGoal}`}
          muted={!trainingPlans.length && weeklyDone === 0}
        />
        <HeroMetric
          icon={latestRecord?.icon ?? 'calendar'}
          label={latestRecord?.label ?? 'Último registo'}
          value={latestRecord?.value ?? 'Sem dados'}
          muted={!latestRecord}
        />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 7 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text2)' }}>Consistência semanal</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'var(--text-sm)', color: weeklyDone >= workoutGoal ? 'var(--teal)' : 'var(--gold)' }}>
            {weeklyPct}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${weeklyPct}%`,
              height: '100%',
              borderRadius: 999,
              background: weeklyDone >= workoutGoal ? 'var(--teal)' : 'var(--gold)',
              transition: 'width .25s ease',
            }}
          />
        </div>
      </div>
    </section>
  )
}

function HeroMetric({
  icon,
  label,
  value,
  muted,
}: {
  icon: 'dumbbell' | 'scale' | 'calendar'
  label: string
  value: string
  muted: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--bg1)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-sm)',
          background: muted ? 'var(--bg3)' : 'rgba(30,203,180,.1)',
          color: muted ? 'var(--text3)' : 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 'var(--text-md)', fontWeight: 700, color: muted ? 'var(--text3)' : 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </div>
      </div>
    </div>
  )
}
