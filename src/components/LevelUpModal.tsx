'use client'
// src/components/LevelUpModal.tsx

import { useEffect, useState } from 'react'

interface LevelUpModalProps {
  level: number
  title: string
  onClose: () => void
}

export default function LevelUpModal({ level, title, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeno delay para a animação de entrada
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  // Partículas decorativas
  const particles = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    angle: (i / 16) * 360,
    delay: (i % 4) * 0.1,
    color: i % 3 === 0 ? 'var(--gold)' : i % 3 === 1 ? 'var(--teal)' : 'var(--accent)',
    size: 4 + (i % 3) * 2,
    distance: 80 + (i % 4) * 20,
  }))

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: `rgba(13,15,20,${visible ? '.92' : '0'})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        transition: 'background .3s ease',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(.85) translateY(24px)',
          transition: 'opacity .35s ease, transform .35s cubic-bezier(.34,1.56,.64,1)',
          position: 'relative',
        }}
      >
        {/* Partículas */}
        <div style={{ position: 'absolute', width: 0, height: 0, top: '50%', left: '50%' }}>
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: p.color,
                top: -p.size / 2, left: -p.size / 2,
                animation: visible
                  ? `lvlParticle 1.2s ${p.delay}s cubic-bezier(.2,.6,.3,1) forwards`
                  : 'none',
                '--angle': `${p.angle}deg`,
                '--dist': `${p.distance}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Anel exterior */}
        <div style={{
          width: 160, height: 160,
          borderRadius: '50%',
          border: '1.5px solid var(--gold)',
          opacity: .15,
          position: 'absolute',
          animation: visible ? 'lvlRingPulse 2s ease-in-out infinite' : 'none',
        }} />

        {/* Círculo principal */}
        <div style={{
          width: 130, height: 130,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(232,168,56,.15), rgba(30,203,180,.1))',
          border: '1.5px solid rgba(232,168,56,.4)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(232,168,56,.2), 0 0 80px rgba(30,203,180,.1)',
          marginBottom: 28,
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
            NÍVEL
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: 56, color: 'var(--gold)', lineHeight: 1,
            animation: visible ? 'lvlNumPop .4s .2s cubic-bezier(.34,1.56,.64,1) both' : 'none',
          }}>
            {level}
          </div>
        </div>

        {/* Texto */}
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{
            fontSize: 11, color: 'var(--teal)', fontWeight: 600,
            letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
          }}>
            SUBISTE DE NÍVEL
          </div>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: 26, color: 'var(--text1)', lineHeight: 1.2, marginBottom: 8,
          }}>
            {title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
            Continua assim. Cada nível é<br />o resultado de dias como hoje.
          </div>
        </div>

        {/* Botão */}
        <button
          onClick={handleClose}
          style={{
            marginTop: 32,
            background: 'linear-gradient(135deg, var(--gold), var(--teal))',
            border: 'none', borderRadius: 14,
            padding: '14px 40px',
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: 15, color: '#0D0F14',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(232,168,56,.3)',
          }}
        >
          Continuar →
        </button>
      </div>

      <style jsx>{`
        @keyframes lvlParticle {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform:
            translate(
              calc(cos(var(--angle)) * var(--dist)),
              calc(sin(var(--angle)) * var(--dist))
            ) scale(0); }
        }
        @keyframes lvlRingPulse {
          0%, 100% { transform: scale(1); opacity: .15; }
          50%       { transform: scale(1.08); opacity: .25; }
        }
        @keyframes lvlNumPop {
          from { transform: scale(.5); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
