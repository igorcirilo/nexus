'use client'
// Regista o service worker no arranque da app. O auto-registo do next-pwa não
// é fiável no App Router, por isso garantimo-lo aqui de forma explícita — sem
// isto, o Web Push fica sem SW e o toggle falha com "no-sw".
import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker()
  }, [])
  return null
}
