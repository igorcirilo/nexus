'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Destinos primários: 3 à esquerda + 3 à direita, com a ação rápida ao centro.
// Hábitos, Progresso e Objetivos vivem agora no hub do Perfil.
const LEFT_ITEMS = [
  { href: '/hoje', label: 'Hoje', icon: HomeIcon },
  { href: '/calendario', label: 'Agenda', icon: CalIcon },
  { href: '/financas', label: 'Finanças', icon: FinanceIcon },
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
      background: 'rgba(var(--card-rgb),.96)',
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
              {active && <span style={activeUnderlineStyle} />}
            </Link>
          )
        })}

        {/* Ação rápida ao centro (novo hábito / transação / pomodoro). */}
        <button
          type="button"
          onClick={emitQuickAction}
          aria-label="Ação rápida"
          className="nav-fab"
          style={{
            flex: '0 0 auto',
            width: 56,
            height: 56,
            marginTop: -22,
            borderRadius: '50%',
            border: '4px solid rgba(var(--card-rgb),.96)',
            background: 'linear-gradient(135deg, #F2C45A, var(--gold))',
            color: 'var(--on-bright)',
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
              {active && <span style={activeUnderlineStyle} />}
            </Link>
          )
        })}
      </div>

      <style jsx>{`
        .nav-fab {
          box-shadow: var(--fab-glow-rest);
          animation: navFabPulse 2.6s ease-in-out infinite;
          transition: transform 0.15s ease;
        }
        .nav-fab:active {
          transform: scale(0.94);
        }
        @keyframes navFabPulse {
          0%, 100% { box-shadow: var(--fab-glow-min); }
          50% { box-shadow: var(--fab-glow-max); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-fab { animation: none; }
        }
      `}</style>
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

const activeUnderlineStyle = {
  width: 16,
  height: 2,
  borderRadius: 1,
  background: 'var(--gold)',
  marginTop: 2,
} satisfies CSSProperties

function Ico({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'var(--gold)' : 'var(--text3)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  )
}

// Conjunto de ícones "Mono Air": linha refinada, geometria suave.
function HomeIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M3 9.6 12 3l9 6.6V19.8a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.8z"/><path d="M9.3 21.3v-7.8h5.4v7.8"/></Ico>
}
function CalIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="3" y="4.6" width="18" height="16.8" rx="3"/><path d="M16 2.5v4"/><path d="M8 2.5v4"/><path d="M3 9.6h18"/></Ico>
}
// Finanças: gráfico circular (pie).
function FinanceIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="8.6"/><path d="M12 3.4V12h8.6"/></Ico>
}
// Perfil: avatar dentro de círculo.
function UserIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="9.1"/><circle cx="12" cy="9.8" r="3"/><path d="M6.7 18.6a5.6 5.6 0 0 1 10.6 0"/></Ico>
}
// Corpo: figura de braços erguidos.
function BodyIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="4.4" r="2"/><path d="M12 6.8v7.2"/><path d="M12 8.2 6.6 4.8"/><path d="M12 8.2 17.4 4.8"/><path d="M12 14 8 20.6"/><path d="M12 14 16 20.6"/></Ico>
}
// Leitura: livro aberto.
function BookIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M12 6.6C10 5.1 7.5 4.4 4.5 4.4v12.8c3 0 5.5.7 7.5 2.2 2-1.5 4.5-2.2 7.5-2.2V4.4c-3 0-5.5.7-7.5 2.2z"/><path d="M12 6.6v13"/></Ico>
}
