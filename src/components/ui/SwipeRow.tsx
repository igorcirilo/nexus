'use client'

import { useRef, useState } from 'react'

/** Quanto o swipe revela de cada botão de ação (px). */
export const SWIPE_ACTION_W = 78

export type SwipeSide = 'left' | 'right'

export interface SwipeAction {
  label: string
  color: string
  onAction: () => void
}

/**
 * Linha com swipe nos dois sentidos (iOS-like): deslizar da esquerda para a
 * direita revela a ação da esquerda (editar), da direita para a esquerda a
 * da direita (apagar). Só captura o gesto quando o movimento é claramente
 * horizontal, para não roubar o scroll vertical. Partilhada pelas listas de
 * lembretes e hábitos da página Hoje.
 */
export default function SwipeRow({
  open,
  onOpenChange,
  leftAction,
  rightAction,
  onClickRow,
  children,
  borderRadius = 10,
}: {
  /** Lado atualmente revelado (controlado pelo pai para abrir um de cada vez). */
  open: SwipeSide | null
  onOpenChange: (side: SwipeSide | null) => void
  /** Revelada ao deslizar esquerda → direita (tipicamente Editar). */
  leftAction?: SwipeAction
  /** Revelada ao deslizar direita → esquerda (tipicamente Apagar). */
  rightAction?: SwipeAction
  onClickRow: () => void
  children: React.ReactNode
  borderRadius?: number
}) {
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; tx: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const moved = useRef(false)

  const restTx = open === 'right' ? -SWIPE_ACTION_W : open === 'left' ? SWIPE_ACTION_W : 0
  const shown = dragging ? tx : restTx

  function down(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, tx: restTx }
    axis.current = null
    moved.current = false
    setTx(restTx)
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
    const min = rightAction ? -SWIPE_ACTION_W - 26 : 0
    const max = leftAction ? SWIPE_ACTION_W + 26 : 0
    setTx(Math.min(max, Math.max(min, start.current.tx + dx)))
  }

  function up() {
    if (!start.current) return
    setDragging(false)
    if (axis.current === 'h') {
      if (rightAction && tx < -SWIPE_ACTION_W / 2) onOpenChange('right')
      else if (leftAction && tx > SWIPE_ACTION_W / 2) onOpenChange('left')
      else onOpenChange(null)
    }
    start.current = null
    axis.current = null
  }

  const actionBtn = (side: SwipeSide, action: SwipeAction): React.CSSProperties => ({
    position: 'absolute', top: 0, bottom: 0, width: SWIPE_ACTION_W,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    border: 'none', background: action.color, color: '#fff',
    fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', touchAction: 'manipulation',
  })

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius }}>
      {leftAction && (
        <button
          type="button"
          onClick={leftAction.onAction}
          tabIndex={open === 'left' ? 0 : -1}
          aria-hidden={open !== 'left'}
          style={actionBtn('left', leftAction)}
        >
          {leftAction.label}
        </button>
      )}
      {rightAction && (
        <button
          type="button"
          onClick={rightAction.onAction}
          tabIndex={open === 'right' ? 0 : -1}
          aria-hidden={open !== 'right'}
          style={actionBtn('right', rightAction)}
        >
          {rightAction.label}
        </button>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (moved.current) return
          if (open) { onOpenChange(null); return }
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
