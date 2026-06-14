'use client'
// src/components/FeedbackToast.tsx
// Toast de feedback positivo (sem XP). Mostra uma mensagem curta de confirmação.
import { useEffect, useState } from 'react'

interface Notification { id: number; msg: string }

let listeners: ((n: Notification) => void)[] = []
let idCounter = 0

export function triggerToast(msg: string) {
  const n = { id: ++idCounter, msg }
  listeners.forEach(l => l(n))
}

export default function FeedbackToast() {
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
      {items.slice(-1).map(n => (
        <div key={'t' + n.id}
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
