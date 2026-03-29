'use client'
// src/components/XPToast.tsx
import { useEffect, useState } from 'react'

interface Notification { id: number; xp: number; msg: string }

let listeners: ((n: Notification) => void)[] = []
let idCounter = 0

export function triggerXP(xp: number, msg: string) {
  const n = { id: ++idCounter, xp, msg }
  listeners.forEach(l => l(n))
}

export default function XPToast() {
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    const handler = (n: Notification) => {
      setItems(p => [...p, n])
      setTimeout(() => setItems(p => p.filter(x => x.id !== n.id)), 2800)
    }
    listeners.push(handler)
    return () => { listeners = listeners.filter(l => l !== handler) }
  }, [])

  return (
    <>
      {/* XP popup centrado */}
      {items.slice(-1).map(n => (
        <div key={n.id}
             className="fixed z-[300] left-1/2 top-[44%] pointer-events-none"
             style={{ transform: 'translate(-50%,-50%)', animation: 'pop .35s ease both' }}>
          <div className="rounded-2xl px-8 py-5 text-center"
               style={{ background: 'var(--bg2)', border: '1px solid rgba(232,168,56,.38)' }}>
            <div className="font-syne font-extrabold text-[44px]" style={{ color: 'var(--gold)' }}>
              +{n.xp}
            </div>
            <div className="text-[12px] mt-1 max-w-[160px] leading-snug" style={{ color: 'var(--text2)' }}>
              {n.msg}
            </div>
          </div>
        </div>
      ))}

      {/* Toast bottom */}
      {items.slice(-1).map(n => (
        <div key={'t'+n.id}
             className="fixed bottom-24 left-1/2 z-[200] pointer-events-none flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px]"
             style={{
               transform: 'translateX(-50%)',
               background: 'var(--bg2)',
               border: '0.5px solid rgba(30,203,180,.38)',
               color: 'var(--teal)',
               animation: 'fadeUp .3s ease both',
             }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {n.msg}
        </div>
      ))}
    </>
  )
}
