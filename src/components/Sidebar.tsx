'use client'
// src/components/Sidebar.tsx — desktop only, renderizado via layout.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/hoje',       label: 'Hoje',       icon: HomeIcon     },
  { href: '/checkin',    label: 'Check-in',   icon: ClockIcon    },
  { href: '/calendario', label: 'Calendário', icon: CalIcon      },
  { href: '/habitos',    label: 'Hábitos',    icon: CheckIcon    },
  { href: '/evolucao',   label: 'Evolução',   icon: ActivityIcon },
  { href: '/dashboard',  label: 'Stats',      icon: GridIcon     },
  { href: '/lembretes',  label: 'Lembretes',  icon: BellIcon     },
  { href: '/perfil',     label: 'Perfil',     icon: UserIcon     },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <div style={{ padding: '28px 14px 24px' }}>
      {/* Logo */}
      <div style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22,
        color: 'var(--gold)', letterSpacing: '-0.5px',
        marginBottom: 32, paddingLeft: 6,
      }}>
        NEXUS
      </div>

      {/* Itens de navegação */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12, textDecoration: 'none',
              fontSize: 14, fontFamily: 'DM Sans, sans-serif',
              transition: 'all .15s',
              background: active ? 'rgba(232,168,56,.10)' : 'transparent',
              color:      active ? 'var(--gold)' : 'var(--text2)',
              border:     active ? '0.5px solid rgba(232,168,56,.20)' : '0.5px solid transparent',
            }}>
              <Icon active={active} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function Ico({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'var(--gold)' : 'var(--text3)'} strokeWidth="1.8"
         style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}
function HomeIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ico>
}
function ClockIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>
}
function CalIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>
}
function CheckIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Ico>
}
function ActivityIcon({ active }: { active: boolean }) {
  return <Ico active={active}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ico>
}
function GridIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Ico>
}
function BellIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Ico>
}
function TargetIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Ico>
}
function EuroIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 10h12M4 14h12M15.5 4.5a9 9 0 1 1 0 15"/></Ico>
}
function UserIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>
}
