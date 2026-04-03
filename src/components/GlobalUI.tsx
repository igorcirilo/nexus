'use client'
// src/components/GlobalUI.tsx
// Componente cliente que renderiza UI global (QuickAction) em todas as páginas
// excepto auth e onboarding

import { usePathname } from 'next/navigation'
import QuickAction from './QuickAction'

const HIDE_ON = ['/auth', '/onboarding']

export default function GlobalUI() {
  const path = usePathname()
  if (HIDE_ON.some(p => path.startsWith(p))) return null
  return <QuickAction />
}
