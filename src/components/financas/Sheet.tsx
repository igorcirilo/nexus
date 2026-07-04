// src/components/financas/Sheet.tsx
//
// Primitivos de UI partilhados da área de finanças, extraídos de page.tsx:
// a concha de bottom sheet e os chips de ± para ajustar valores. Também os
// estilos de label/input dos sheets.
import type React from 'react'

export const sheetLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'var(--text3)', display: 'block', margin: '16px 0 8px', fontFamily: 'Inter, sans-serif',
}
export const sheetInp: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.10)',
  borderRadius: 13, padding: '12px 14px', color: 'var(--ink)',
  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, outline: 'none',
}

// Concha de bottom sheet partilhada (design do hub).
export function Sheet({ icon, title, onClose, children, footer, tall }: {
  icon?: string; title: string; onClose: () => void
  children: React.ReactNode; footer?: React.ReactNode; tall?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--surface-card)',
        borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(var(--ink-rgb),0.12)',
        display: 'flex', flexDirection: 'column',
        maxHeight: tall ? '92dvh' : 'min(86dvh, 720px)',
        ...(tall ? { height: '92dvh' } : {}),
        fontFamily: 'Inter, sans-serif', boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 12px', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
          {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
          <div style={{ flex: 1, fontWeight: 800, fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.3px' }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text1)' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px 16px' }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: 'var(--surface-card)', borderTop: '1px solid rgba(var(--ink-rgb),0.06)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Chips de ± para ajustar valores nos sheets.
export function StepChips({ steps, onStep }: { steps: number[]; onStep: (delta: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {steps.map(s => (
        <button key={s} onClick={() => onStep(s)} style={{
          flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 12, cursor: 'pointer',
          border: `1px solid ${s > 0 ? 'rgba(245,200,66,0.45)' : 'rgba(var(--ink-rgb),0.10)'}`,
          background: s > 0 ? 'rgba(245,200,66,0.10)' : 'rgba(var(--ink-rgb),0.03)',
          color: s > 0 ? '#F5C842' : 'rgba(var(--ink-rgb),0.6)',
          fontSize: 12.5, fontWeight: 700, fontFamily: 'Inter, sans-serif',
        }}>{s > 0 ? '+' : '−'}€{Math.abs(s)}</button>
      ))}
    </div>
  )
}
