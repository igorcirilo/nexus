'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Diálogo de confirmação para ações destrutivas (apagar plano, dieta, registro).
// Segue o padrão de portal/z-index dos modais do Corpo (9200–9499).
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const portalRef = useRef<Element | null>(null)

  useEffect(() => {
    portalRef.current = document.body
    setMounted(true)
  }, [])

  if (!open || !mounted || !portalRef.current) return null

  return createPortal(
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 9450,
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          inset: 16,
          zIndex: 9451,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'var(--bg1)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 20px 16px',
            boxShadow: '0 20px 80px rgba(0,0,0,.35)',
            pointerEvents: 'auto',
          }}
        >
          <p
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text1)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </p>
          {body && (
            <p
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                color: 'var(--text2)',
                margin: '8px 0 0',
                lineHeight: 1.45,
              }}
            >
              {body}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button
              onClick={onCancel}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 14px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                background: '#E24B4A',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--on-accent)',
                cursor: 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    portalRef.current
  )
}
