'use client'
// src/components/MissionCard.tsx
import { useEffect, useState } from 'react'

type Props = {
  mission: string
  progress?: number
  onProgress?: React.Dispatch<React.SetStateAction<number>> | ((value: number) => void)
}

export default function MissionCard({ mission, progress = 0, onProgress }: Props) {
  const [localProgress, setLocalProgress] = useState(progress)

  useEffect(() => { setLocalProgress(progress) }, [progress])

  const pct = Math.max(0, Math.min(100, localProgress))

  function updateProgress(next: number) {
    const safe = Math.max(0, Math.min(100, next))
    setLocalProgress(safe)
    onProgress?.(safe)
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>

      {/* Missão + % */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 4 }}>
            Missão principal
          </div>
          <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 500, fontSize: 15, color: 'var(--text1)', lineHeight: 1.42, letterSpacing: 0 }}>
            {mission}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 500, fontSize: 20, lineHeight: 1, color: 'var(--gold)', letterSpacing: 0 }}>{pct}%</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>concluído</div>
        </div>
      </div>

      {/* Slider */}
      <input
        type="range" min={0} max={100} step={5} value={pct}
        onChange={(e) => updateProgress(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--gold)', marginBottom: 2 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  )
}
