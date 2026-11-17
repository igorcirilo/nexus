// Gestão do tema (claro/escuro) — persiste em localStorage e aplica
// data-theme no <html>. O script inline no layout evita flash no arranque.

import type { CSSProperties } from 'react'

export type Theme = 'dark' | 'light'

// Cor de marca (hex fixo) → variante "-ink" que acompanha o tema. Usada em
// ícones de traço fino: o hex bruto (teal, dourado) fica lavado sobre fundos
// claros; a variante -ink escurece no tema claro e mantém-se viva no escuro.
const INK_BY_HEX: Record<string, string> = {
  '#1ECBB4': 'var(--teal-ink)', '#00D4C8': 'var(--teal-ink)',
  '#00C896': 'var(--green-ink)', '#1D9E75': 'var(--green-ink)',
  '#E8A838': 'var(--gold-ink)', '#F5C842': 'var(--gold-ink)', '#F2C45A': 'var(--gold-ink)', '#E2884B': 'var(--gold-ink)',
  '#7F77DD': 'var(--accent-ink)', '#9C94EC': 'var(--purple-ink)', '#9D5CF5': 'var(--purple-ink)',
  '#85B7EB': 'var(--blue-ink)', '#E24B4A': 'var(--red-ink)',
}
export function inkFor(color: string | undefined): string | undefined {
  if (!color) return color
  return INK_BY_HEX[color.toUpperCase()] ?? color
}

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
