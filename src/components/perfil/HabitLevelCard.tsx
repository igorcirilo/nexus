'use client'

import { useState } from 'react'
import { HABIT_LEVELS, regenerateHabitsForLevel, type HabitLevel } from '@/lib/assessment-to-habits'

interface Props {
  userId: string
  currentLevel: number | null
}

/**
 * Permite subir/descer o nível de intensidade dos hábitos. Regenera o conjunto
 * de hábitos de onboarding preservando logs e hábitos manuais.
 * Só aparece para utilizadores que já têm um nível definido.
 */
export default function HabitLevelCard({ userId, currentLevel }: Props) {
  const initial = (currentLevel ?? 1) as HabitLevel
  const [level, setLevel] = useState<HabitLevel>(initial)
  const [applied, setApplied] = useState<HabitLevel>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  if (currentLevel == null) return null

  const dirty = level !== applied

  async function confirm() {
    setSaving(true)
    setError(false)
    try {
      await regenerateHabitsForLevel(userId, level)
      setApplied(level)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ margin: '0 20px 20px', padding: '16px', background: 'var(--bg2)', borderRadius: 16, border: '0.5px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)', marginBottom: 2 }}>
        Nível de hábitos
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Ajusta a intensidade. Subir adiciona hábitos; descer guarda os que saem (sem perder histórico).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
        {HABIT_LEVELS.map((spec) => {
          const active = spec.level === level
          return (
            <button
              key={spec.level}
              type="button"
              onClick={() => setLevel(spec.level)}
              aria-pressed={active}
              style={{
                padding: '10px 4px',
                borderRadius: 12,
                border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                background: active ? 'rgba(232,168,56,.10)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                touchAction: 'manipulation',
                minHeight: 56,
              }}
            >
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: active ? 'var(--gold)' : 'var(--text1)' }}>
                {spec.level}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>{spec.total} háb.</span>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
        {HABIT_LEVELS.find((s) => s.level === level)?.label}
      </div>

      {error && <p style={{ fontSize: 12, color: '#E24B4A', marginBottom: 10 }}>Não foi possível aplicar. Tenta de novo.</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!dirty || saving}
        style={{
          width: '100%',
          minHeight: 44,
          borderRadius: 12,
          border: 'none',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 800,
          fontSize: 14,
          cursor: !dirty || saving ? 'not-allowed' : 'pointer',
          background: !dirty ? 'var(--bg3)' : 'linear-gradient(180deg, #F4C85A, var(--gold))',
          color: !dirty ? 'var(--text3)' : 'var(--bg0)',
          touchAction: 'manipulation',
        }}
      >
        {saving ? 'A aplicar…' : dirty ? `Mudar para nível ${level}` : 'Nível atual'}
      </button>
    </div>
  )
}
