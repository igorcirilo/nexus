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
  const [running,  setRunning]  = useState(false)
  const [secs,     setSecs]     = useState(25 * 60)
  const [localPct, setLocalPct] = useState(progress)
  const iv = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setLocalPct(progress) }, [progress])

  function start() {
    setRunning(true)
    setSecs(25 * 60)
    iv.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { clearInterval(iv.current!); finish(); return 0 }
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
    onXP(10, 'Bloco de foco concluído!')
    await saveFocusSession(userId, 25, mission)
  }

  const mm = Math.floor(secs / 60).toString().padStart(2, '0')
  const ss = (secs % 60).toString().padStart(2, '0')
  const hasMission = !!mission.trim()

  return (
    <div style={{
      margin: '12px 20px 0',
      padding: '16px',
      borderRadius: 18,
      background: 'var(--bg2)',
      border: '0.5px solid rgba(127,119,221,.28)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(127,119,221,.07)',
        pointerEvents: 'none',
      }} />

      {/* Tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, color: 'var(--accent)',
        background: 'rgba(127,119,221,.12)',
        padding: '3px 10px', borderRadius: 100,
        textTransform: 'uppercase', letterSpacing: '.5px',
        marginBottom: 10, fontWeight: 600,
      }}>
        <span>🎯</span> Missão Principal
      </div>

      {/* Texto da missão */}
      <p style={{
        fontFamily: 'Syne, sans-serif',
        fontWeight: 600,
        fontSize: 15,
        lineHeight: 1.4,
        color: hasMission ? 'var(--text1)' : 'var(--text3)',
        margin: '0 0 14px 0',
        fontStyle: hasMission ? 'normal' : 'italic',
      }}>
        {hasMission ? mission : 'Define a tua missão no check-in da manhã'}
      </p>

      {/* Barra de progresso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 100,
          background: 'var(--bg3)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 100,
            background: localPct >= 100 ? 'var(--teal)' : 'var(--accent)',
            width: `${localPct}%`,
            transition: 'width .6s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 32, textAlign: 'right', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
          {localPct}%
        </span>
      </div>

      {/* Timer activo */}
      {running && (
        <div style={{ textAlign: 'center', marginBottom: 12, padding: '8px 0' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 32, color: 'var(--gold)', lineHeight: 1 }}>
            {mm}:{ss}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Bloco de foco activo — mantém o ritmo
          </div>
        </div>
      )}

      {/* Botão Pomodoro */}
      <button onClick={running ? stop : start} style={{
        width: '100%',
        padding: '11px',
        borderRadius: 12,
        border: running ? '0.5px solid rgba(232,168,56,.3)' : '0.5px solid rgba(127,119,221,.28)',
        background: running ? 'rgba(232,168,56,.07)' : 'rgba(127,119,221,.08)',
        color: running ? 'var(--gold)' : 'var(--accent)',
        fontFamily: 'Syne, sans-serif',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        transition: 'all .2s',
      }}>
        <span style={{ fontSize: 13 }}>{running ? '⏸' : '▶'}</span>
        {running ? 'Parar foco' : 'Iniciar Foco — 25 min'}
      </button>
    </div>
  )
}
