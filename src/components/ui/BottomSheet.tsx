'use client'

import type { ReactNode } from 'react'
import Icon from '@/components/ui/Icon'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.58)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Painel'}
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 512,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--bg1)',
          border: '0.5px solid var(--border)',
          borderRadius: '20px 20px 0 0',
          padding: '10px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -18px 60px rgba(0,0,0,.38)',
        }}
      >
        <div aria-hidden="true" style={{ width: 34, height: 4, borderRadius: 4, background: 'var(--border)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: title ? 16 : 8 }}>
          {title ? (
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text1)' }}>
              {title}
            </h2>
          ) : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            style={{
              width: 44,
              height: 44,
              border: 'none',
              borderRadius: 12,
              background: 'var(--bg3)',
              color: 'var(--text2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
