'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'

const PRIMARY_ITEMS = [
  { href: '/hoje', label: 'Hoje', icon: HomeIcon },
  { href: '/habitos', label: 'Hábitos', icon: CheckIcon },
  { href: '/corpo', label: 'Corpo', icon: BodyIcon },
  { href: '/progresso', label: 'Progresso', icon: ActivityIcon },
]

const SECONDARY_ITEMS = [
  { href: '/calendario', label: 'Calendário', icon: CalIcon },
  { href: '/financas', label: 'Finanças', icon: EuroIcon },
  { href: '/leitura', label: 'Leitura', icon: BookIcon },
  { href: '/objetivos', label: 'Objetivos', icon: TargetIcon },
  { href: '/perfil', label: 'Perfil', icon: UserIcon },
]

export default function Nav() {
  const path = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [path])

  const moreActive = SECONDARY_ITEMS.some(item => path === item.href)

  return (
    <>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          alignItems: 'center',
          padding: '7px 10px 8px',
          width: '100%',
          gap: 2,
        }}>
          {PRIMARY_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href === '/progresso' && (path === '/evolucao' || path === '/dashboard'))
            return (
              <Link key={href} href={href} style={navItemStyle(active)}>
                <Icon active={active} />
                <span style={labelStyle(active)}>{label}</span>
                {active && <span style={activeDotStyle} />}
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Abrir mais páginas"
            aria-pressed={moreActive}
            style={{
              ...navItemStyle(moreActive),
              border: 'none',
              background: 'transparent',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <MoreIcon active={moreActive} />
            <span style={labelStyle(moreActive)}>Mais</span>
            {moreActive && <span style={activeDotStyle} />}
          </button>
        </div>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais">
        <div style={{ display: 'grid', gap: 8 }}>
          {SECONDARY_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  minHeight: 52,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 12px',
                  borderRadius: 14,
                  background: active ? 'rgba(232,168,56,.1)' : 'var(--bg2)',
                  border: active ? '0.5px solid rgba(232,168,56,.24)' : '0.5px solid var(--border)',
                  color: active ? 'var(--gold)' : 'var(--text2)',
                  textDecoration: 'none',
                  touchAction: 'manipulation',
                }}
              >
                <Icon active={active} />
                <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 14, fontWeight: active ? 600 : 500 }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}

function navItemStyle(active: boolean): CSSProperties {
  return {
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
function CheckIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><path d="M12 6v6l4 2"/></Ico>
}
function ActivityIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></Ico>
}
function EuroIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 10h12"/><path d="M4 14h12"/><path d="M15.5 4.5a9 9 0 1 1 0 15"/></Ico>
}
function TargetIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Ico>
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
function MoreIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/></Ico>
}
