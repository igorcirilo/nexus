'use client'

import { useRef, useState } from 'react'

/** Quanto o swipe revela do botão de ação (px). */
export const SWIPE_ACTION_W = 78

/**
 * Linha com swipe para a esquerda que revela um botão de ação (iOS-like).
 * Só captura o gesto quando o movimento é claramente horizontal, para não
 * roubar o scroll vertical da página. Partilhada pelas listas de lembretes
 * e hábitos da página Hoje.
 */
export default function SwipeRow({
  open,
  onOpenChange,
  actionLabel,
  actionColor,
  onAction,
  onClickRow,
  children,
  borderRadius = 10,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionLabel: string
  actionColor: string
  onAction: () => void
  onClickRow: () => void
  children: React.ReactNode
  borderRadius?: number
}) {
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; tx: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const moved = useRef(false)

  const shown = dragging ? tx : open ? -SWIPE_ACTION_W : 0

  function down(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, tx: open ? -SWIPE_ACTION_W : 0 }
    axis.current = null
    moved.current = false
    setTx(open ? -SWIPE_ACTION_W : 0)
    setDragging(true)
  }

  function move(e: React.PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (!axis.current) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis.current === 'h') (e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
    if (axis.current !== 'h') return
    moved.current = true
    setTx(Math.min(0, Math.max(-SWIPE_ACTION_W - 26, start.current.tx + dx)))
  }

  function up() {
    if (!start.current) return
    setDragging(false)
    if (axis.current === 'h') onOpenChange(tx < -SWIPE_ACTION_W / 2)
    start.current = null
    axis.current = null
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius }}>
      <button
        type="button"
        onClick={onAction}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_ACTION_W,
          border: 'none', background: actionColor, color: '#fff',
          fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', touchAction: 'manipulation',
        }}
      >
        {actionLabel}
      </button>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (moved.current) return
          if (open) { onOpenChange(false); return }
          onClickRow()
        }}
        style={{
          transform: `translateX(${shown}px)`,
          transition: dragging ? 'none' : 'transform .22s ease',
          background: 'rgba(var(--card-rgb),1)',
          touchAction: 'pan-y',
          cursor: 'pointer',
        }}
      >
        {children}
      </div>
    </div>
  )
}
