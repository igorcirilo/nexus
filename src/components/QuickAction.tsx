'use client'
// src/components/QuickAction.tsx

import { useState, useEffect } from 'react'

export default function QuickAction() {
  const [open, setOpen] = useState(false)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-quickaction]')) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const actions = [
    {
      label: '＋ Hábito',
      icon: '✅',
      color: 'var(--teal)',
      bg: 'rgba(30,203,180,.12)',
      href: '/habitos',
    },
    {
      label: '＋ Transacção',
      icon: '💰',
      color: 'var(--gold)',
      bg: 'rgba(232,168,56,.12)',
      href: '/financas',
    },
    {
      label: 'Pomodoro',
      icon: '⏱',
      color: 'var(--accent)',
      bg: 'rgba(127,119,221,.12)',
      href: '/hoje#pomodoro',
    },
  ]

  return (
    <div data-quickaction style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

      {/* Mini-menu */}
      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'qaMenuIn .18s ease',
        }}>
          {actions.map((a) => (
            <a
              key={a.label}
              href={a.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg1)',
                border: `0.5px solid ${a.color}44`,
                borderRadius: 14,
                padding: '10px 14px',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,.35)',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: a.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                {a.icon}
              </div>
              <span style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 600,
                fontSize: 13, color: a.color,
              }}>
                {a.label}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Botão principal */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 52, height: 52,
          borderRadius: '50%',
          border: 'none',
          background: open
            ? 'var(--bg3)'
            : 'linear-gradient(135deg, var(--teal), var(--accent))',
          color: '#fff',
          fontSize: open ? 22 : 26,
          fontWeight: 300,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open
            ? '0 2px 12px rgba(0,0,0,.3)'
            : '0 4px 20px rgba(30,203,180,.35)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform .2s ease, background .2s ease, box-shadow .2s ease',
          flexShrink: 0,
        }}
        aria-label="Acção rápida"
      >
        ＋
      </button>

      <style jsx>{`
        @keyframes qaMenuIn {
          from { opacity: 0; transform: translateY(8px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
