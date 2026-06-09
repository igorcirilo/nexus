'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'

interface TodayMissionPanelProps {
  mission: string
  progress?: number
  onProgress?: (value: number) => void
}

export default function TodayMissionPanel({ mission, progress = 0, onProgress }: TodayMissionPanelProps) {
  const [localProgress, setLocalProgress] = useState(progress)
  const pct = Math.max(0, Math.min(100, localProgress))
  const currentStep = Math.min(5, Math.max(1, Math.round(pct / 25) + 1))

  useEffect(() => {
    setLocalProgress(progress)
  }, [progress])

  function updateProgress(next: number) {
    const safe = Math.max(0, Math.min(100, next))
    setLocalProgress(safe)
    onProgress?.(safe)
  }

  return (
    <section style={{ margin: '12px 20px 0', padding: 18, borderRadius: 20, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div style={{ minWidth: 0, display: 'flex', gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 14, color: 'var(--gold)', background: 'rgba(232,168,56,.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="4" />
              <path d="M15.5 8.5 21 3" />
              <path d="M17 3h4v4" />
            </svg>
          </span>
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text1)', marginBottom: 3 }}>
              Missão do dia
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text2)' }}>
              {mission}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 24, fontWeight: 600, lineHeight: 1, color: 'var(--gold)' }}>
            {currentStep}/5
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>etapas</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center', gap: 0, position: 'relative', marginBottom: 14 }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 10, right: 10, top: 21, height: 3, borderRadius: 3, background: 'var(--bg3)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 10, top: 21, height: 3, width: pct === 0 ? 0 : `calc(${pct}% - 20px)`, maxWidth: 'calc(100% - 20px)', borderRadius: 3, background: 'var(--gold)' }} />
        {[1, 2, 3, 4, 5].map(step => {
          const complete = step < currentStep
          const active = step === currentStep
          return (
            <button
              key={step}
              type="button"
              aria-label={`Definir missão na etapa ${step}`}
              onClick={() => updateProgress((step - 1) * 25)}
              style={{
                width: 44,
                height: 44,
                justifySelf: step === 1 ? 'start' : step === 5 ? 'end' : 'center',
                borderRadius: '50%',
                border: active ? 'none' : '1px solid var(--border)',
                background: complete || active ? 'var(--gold)' : 'var(--bg2)',
                color: complete || active ? 'var(--bg0)' : 'var(--text3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                touchAction: 'manipulation',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {complete ? <Icon name="check" size={16} /> : step}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text2)' }}>
        Mantenha o ritmo. Pequenas vitórias constroem o todo.
      </div>
    </section>
  )
}
