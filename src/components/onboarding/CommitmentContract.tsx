'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Ecrã de contrato de compromisso no fim do onboarding (adaptado das ideias de
 * referência). "Mantém premido para aceitar" → preenche em ~1.2s e confirma.
 */

const FONT = 'Inter, sans-serif'
const HOLD_MS = 1200

const VOWS = [
  'Vou aparecer todos os dias, mesmo nos pequenos passos.',
  'Vou equilibrar criar bons hábitos e largar os maus.',
  'Recomeçar faz parte — uma recaída não me define.',
  'Vou tornar-me a minha melhor versão, 1% por dia.',
]

interface Props {
  name: string
  loading?: boolean
  onAccept: () => void
}

export default function CommitmentContract({ name, loading, onAccept }: Props) {
  const [holding, setHolding] = useState(false)
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function start() {
    if (done || loading) return
    setHolding(true)
    timer.current = setTimeout(() => {
      setDone(true)
      setHolding(false)
      onAccept()
    }, HOLD_MS)
  }
  function cancel() {
    if (timer.current) clearTimeout(timer.current)
    if (!done) setHolding(false)
  }

  const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg0)', fontFamily: FONT, padding: '0 22px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 66, height: 66, borderRadius: 20, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: 'linear-gradient(135deg, rgba(232,168,56,.2), rgba(127,119,221,.16))', border: '1px solid rgba(232,168,56,.4)' }}>🤝</div>
        <h1 style={{ textAlign: 'center', marginTop: 18, fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px' }}>O teu compromisso</h1>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13, lineHeight: 1.55, color: 'var(--text2)', padding: '0 6px' }}>
          Assinar um compromisso aumenta a probabilidade de o cumprires. Este é o teu.
        </p>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {VOWS.map((v) => (
            <div key={v} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '14px 15px', borderRadius: 15, background: 'rgba(var(--ink-rgb),.035)', border: '1px solid var(--border)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(30,203,180,.16)', color: '#1ECBB4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
              <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text1)', fontWeight: 500 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 0 28px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <button
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          disabled={loading || done}
          style={{
            position: 'relative',
            width: '100%',
            height: 58,
            borderRadius: 18,
            border: '1.5px solid rgba(232,168,56,.5)',
            background: 'rgba(232,168,56,.12)',
            cursor: done ? 'default' : 'pointer',
            overflow: 'hidden',
            touchAction: 'none',
            userSelect: 'none',
            fontFamily: FONT,
          }}
        >
          <span
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: holding || done ? '100%' : '0%',
              background: 'rgba(232,168,56,.28)',
              transition: holding ? `width ${HOLD_MS}ms linear` : 'width .2s ease',
            }}
          />
          <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 3 }}>
            <b style={{ fontSize: 15, fontWeight: 800, color: '#F2C45A' }}>
              {loading ? 'A preparar…' : done ? 'Compromisso assinado ✓' : 'Mantém premido para aceitar'}
            </b>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{name} · {today}</span>
          </span>
        </button>
      </div>
    </div>
  )
}
