// src/components/Toast.tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ToastType } from '@/lib/toast-events'

type ToastItem = { id: number; message: string; type: ToastType }
type ToastCtx = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

const Ctx = createContext<ToastCtx | null>(null)

const BG: Record<ToastType, string> = {
  success: '#1D9E75',
  error:   '#E24B4A',
  info:    '#7F77DD',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++nextId.current
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    const t = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    timers.current.push(t)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      add(message, type)
    }
    window.addEventListener('nexus-toast', handler)
    return () => {
      window.removeEventListener('nexus-toast', handler)
      timers.current.forEach(clearTimeout)
    }
  }, [add])

  return (
    <Ctx.Provider value={{ success: m => add(m, 'success'), error: m => add(m, 'error'), info: m => add(m, 'info') }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 88, right: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: BG[t.type],
            color: '#fff',
            padding: '11px 16px',
            borderRadius: 12,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,.4)',
            animation: 'fadeUp .2s ease',
            maxWidth: 300,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast fora de ToastProvider')
  return ctx
}
