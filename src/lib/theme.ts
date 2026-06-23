// Gestão do tema (claro/escuro) — persiste em localStorage e aplica
// data-theme no <html>. O script inline no layout evita flash no arranque.

import type { CSSProperties } from 'react'

export type Theme = 'dark' | 'light'

// Fixa o primeiro-plano a branco dentro de cards escuros "hero" (gradientes
// vibrantes que se mantêm escuros nos dois temas). Espalhar no style do card
// faz todo o texto/overlays interno (var(--ink) / rgba(var(--ink-rgb),…))
// continuar branco mesmo no tema claro.
export const darkCardInk = {
  '--ink': '#fff',
  '--ink-rgb': '255,255,255',
  '--text1': '#fff',
  '--text2': 'rgba(255,255,255,0.72)',
  '--text3': 'rgba(255,255,255,0.5)',
  '--surface-2': 'rgba(255,255,255,0.06)',
  '--surface-3': 'rgba(255,255,255,0.10)',
} as unknown as CSSProperties

const STORAGE_KEY = 'nexus-theme'
const EVENT = 'nexus-theme-change'

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* localStorage indisponível — ignora */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }))
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function onThemeChange(cb: (theme: Theme) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Theme>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
