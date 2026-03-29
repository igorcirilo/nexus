'use client'
// src/components/MissionCard.tsx
import { useState, useEffect, useRef } from 'react'
import { saveFocusSession } from '@/lib/supabase'

interface Props {
  mission: string
  progress: number
  userId: string
  onXP: (xp: number, msg: string) => void
  onProgressUpdate: (pct: number) => void
}

export default function MissionCard({ mission, progress, userId, onXP, onProgressUpdate }: Props) {
  const [running, setRunning] = useState(false)
  const [secs, setSecs]       = useState(25 * 60)
  const [localPct, setLocalPct] = useState(progress)
  const iv = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setLocalPct(progress) }, [progress])

  function start() {
    setRunning(true)
    setSecs(25 * 60)
    iv.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(iv.current!)
          finish()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function stop() {
    clearInterval(iv.current!)
    setRunning(false)
    setSecs(25 * 60)
  }

  async function finish() {
    setRunning(false)
    const newPct = Math.min(100, localPct + 15)
    setLocalPct(newPct)
    onProgressUpdate(newPct)
    onXP(10, 'Bloco de foco concluído! +15% na missão')
    await saveFocusSession(userId, 25, mission)
  }

  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')

  return (
    <div className="card-accent mx-5 mt-3 p-4">
      <div className="chip-accent mb-2.5">Missão Principal</div>
      <p className="font-syne font-semibold text-[16px] leading-snug mb-3 text-text-1">
        {mission || 'Define a tua missão no check-in da manhã'}
      </p>

      {/* Barra de progresso */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1 bg-bg-3 rounded-full h-1.5">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${localPct}%`, background: 'var(--accent)' }} />
        </div>
        <span className="text-xs text-text-2 min-w-[30px] text-right">{localPct}%</span>
      </div>

      {/* Timer activo */}
      {running && (
        <div className="text-center mb-3">
          <div className="font-syne font-bold text-3xl" style={{ color: 'var(--gold)' }}>
            {m}:{s}
          </div>
          <div className="text-[11px] text-text-3 mt-1">Bloco de foco ativo — mantém o ritmo</div>
        </div>
      )}

      {/* Botão Pomodoro */}
      <button
        onClick={running ? stop : start}
        className={running ? 'btn-ghost border-gold/30 text-gold bg-gold/8' : 'btn-ghost'}
        style={running ? { borderColor: 'rgba(232,168,56,.3)', color: 'var(--gold)', background: 'rgba(232,168,56,.06)' } : {}}>
        {running ? '⏸ Parar foco' : '▶ Iniciar Foco — 25 min'}
      </button>
    </div>
  )
}
