'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Destinos primários: 3 à esquerda + 3 à direita, com a ação rápida ao centro.
// Hábitos, Progresso e Objetivos vivem agora no hub do Perfil.
const LEFT_ITEMS = [
  { href: '/hoje', label: 'Hoje', icon: HomeIcon },
  { href: '/calendario', label: 'Agenda', icon: CalIcon },
  { href: '/financas', label: 'Finanças', icon: EuroIcon },
]
const RIGHT_ITEMS = [
  { href: '/corpo', label: 'Corpo', icon: BodyIcon },
  { href: '/leitura', label: 'Leitura', icon: BookIcon },
  { href: '/perfil', label: 'Perfil', icon: UserIcon },
]

function emitQuickAction() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus:quickaction-toggle'))
  }
}

export default function Nav() {
  const path = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'rgba(20,23,32,.96)',
      borderTop: '0.5px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 8px 8px' }}>
        {LEFT_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href} style={navItemStyle(active)}>
              <Icon active={active} />
              <span style={labelStyle(active)}>{label}</span>
              {active && <span style={activeDotStyle} />}
            </Link>
          )
        })}

        {/* Ação rápida ao centro (novo hábito / transação / pomodoro). */}
        <button
          type="button"
          onClick={emitQuickAction}
          aria-label="Ação rápida"
          style={{
            flex: '0 0 auto',
            width: 54,
            height: 54,
            marginTop: -20,
            borderRadius: '50%',
            border: '4px solid rgba(20,23,32,.96)',
            background: 'linear-gradient(135deg, var(--teal), var(--accent))',
            color: '#fff',
            fontSize: 26,
            fontWeight: 300,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(30,203,180,.4)',
            touchAction: 'manipulation',
          }}
        >
          ＋
        </button>

        {RIGHT_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href} style={navItemStyle(active)}>
              <Icon active={active} />
              <span style={labelStyle(active)}>{label}</span>
              {active && <span style={activeDotStyle} />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function navItemStyle(active: boolean): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: 0,
    minHeight: 52,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    textDecoration: 'none',
    color: active ? 'var(--gold)' : 'var(--text3)',
    position: 'relative',
    touchAction: 'manipulation',
  }
}

function labelStyle(active: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
  }
}

const activeDotStyle = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: 'var(--gold)',
  marginTop: 1,
} satisfies CSSProperties

function Ico({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'var(--gold)' : 'var(--text3)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></Ico>
}
function CalIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v6"/><path d="M8 2v6"/><path d="M3 10h18"/></Ico>
}
function EuroIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 10h12"/><path d="M4 14h12"/><path d="M15.5 4.5a9 9 0 1 1 0 15"/></Ico>
}
function UserIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>
}
function BodyIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M8 18h8"/><path d="M9 18V8a3 3 0 0 1 6 0v10"/><path d="M6 12h12"/><path d="M4 10v4"/><path d="M20 10v4"/></Ico>
}
function BookIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23z"/><path d="M8 7h8"/><path d="M8 11h8"/></Ico>
}
