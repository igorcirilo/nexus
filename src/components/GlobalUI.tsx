'use client'
// src/components/GlobalUI.tsx
// Componente cliente que renderiza UI global (QuickAction) em todas as páginas
// excepto auth e onboarding

import { usePathname } from 'next/navigation'
import QuickAction from './QuickAction'

const HIDE_ON = ['/auth', '/onboarding', '/perfil']

// Rotas com UI imersiva ou ação primária própria onde o FAB global
// taparia controlos da página (ex.: reader de leitura em ecrã cheio,
// formulário de edição do perfil).
const HIDE_ON_PATTERNS = [/^\/leitura\/.+/]

export default function GlobalUI() {
  const path = usePathname()
  if (HIDE_ON.some(p => path.startsWith(p))) return null
  if (HIDE_ON_PATTERNS.some(rx => rx.test(path))) return null
  return <QuickAction />
}
