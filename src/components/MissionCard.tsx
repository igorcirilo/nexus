'use client'
// src/components/MissionCard.tsx
import { useEffect, useMemo, useState } from 'react'

type Props = {
  mission: string
  progress?: number
  onProgress?: React.Dispatch<React.SetStateAction<number>> | ((value: number) => void)
}

export default function MissionCard({ mission, progress = 0, onProgress }: Props) {
  const [localProgress, setLocalProgress] = useState(progress)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    setLocalProgress(progress)
  }, [progress])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const pct = Math.max(0, Math.min(100, localProgress))

  const timeLabel = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const secs = (secondsLeft % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }, [secondsLeft])

  function updateProgress(next: number) {
    const safe = Math.max(0, Math.min(100, next))
    setLocalProgress(safe)
    onProgress?.(safe)
  }

  function resetPomodoro() {
    setRunning(false)
    setSecondsLeft(25 * 60)
  }

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--gold)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            Missão principal
          </div>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--text1)',
              lineHeight: 1.3,
            }}
          >
            {mission}
          </div>
        </div>

        <div
          style={{
            minWidth: 72,
            alignSelf: 'flex-start',
            textAlign: 'right',
          }}
        >
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--gold)' }}>
            {pct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>concluído</div>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          background: 'var(--bg3)',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--gold), var(--teal))',
            transition: 'width .2s ease',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => updateProgress(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--gold)' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text3)',
            marginTop: 4,
          }}
        >
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(127,119,221,.08)',
          border: '0.5px solid rgba(127,119,221,.22)',
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 700 }}>
              Pomodoro
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text1)' }}>
              {timeLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                background: 'var(--gold)',
                color: 'var(--bg0)',
              }}
            >
              {running ? 'Pausar' : 'Iniciar'}
            </button>
            <button
              type="button"
              onClick={resetPomodoro}
              style={{
                border: '0.5px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                background: 'var(--bg3)',
                color: 'var(--text2)',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
          Faz um bloco de 25 minutos focado nesta missão. Quando terminares, actualiza o progresso acima.
        </div>
      </div>
    </div>
  )
}
