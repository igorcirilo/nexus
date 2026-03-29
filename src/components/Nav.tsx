'use client'
// src/components/Nav.tsx
// Classe .mobile-nav → escondida em desktop via globals.css
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/hoje',       label: 'Hoje',     icon: HomeIcon     },
  { href: '/checkin',    label: 'Check-in', icon: ClockIcon    },
  { href: '/calendario', label: 'Cal',      icon: CalIcon      },
  { href: '/habitos',    label: 'Hábitos',  icon: CheckIcon    },
  { href: '/evolucao',   label: 'Evolução', icon: ActivityIcon },
  { href: '/dashboard',  label: 'Stats',    icon: GridIcon     },
  { href: '/lembretes',  label: 'Alertas',  icon: BellIcon     },
  { href: '/perfil',     label: 'Perfil',   icon: UserIcon     },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--bg1)',
      borderTop: '0.5px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      overflowX: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 4px', minWidth: 'max-content', margin: '0 auto',
      }}>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 10px', borderRadius: 10, textDecoration: 'none',
              color: active ? 'var(--gold)' : 'var(--text3)',
              minWidth: 48, flexShrink: 0,
            }}>
              <Icon active={active} />
              <span style={{ fontSize: 8, fontFamily: 'var(--font-dm)', whiteSpace: 'nowrap' }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function Ico({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'var(--gold)' : 'var(--text3)'} strokeWidth="1.8">
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
function UserIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>
}
