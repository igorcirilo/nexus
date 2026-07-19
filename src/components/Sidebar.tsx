'use client'
// src/components/Sidebar.tsx — desktop sidebar
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/hoje',      label: 'Hoje',        icon: HomeIcon     },
  { href: '/financas',  label: 'Finanças',    icon: EuroIcon     },
  { href: '/corpo',     label: 'Corpo',       icon: BodyIcon     },
  { href: '/calendario',label: 'Calendário',  icon: CalIcon      },
  { href: '/leitura',   label: 'Leitura',     icon: BookIcon     },
  { href: '/habitos',   label: 'Hábitos',     icon: CheckIcon    },
  { href: '/objetivos', label: 'Objectivos',  icon: TargetIcon   },
  { href: '/estatisticas', label: 'Estatísticas', icon: ActivityIcon },
  { href: '/perfil',    label: 'Perfil',      icon: UserIcon     },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside style={{
      width: 220, flexShrink: 0, background: 'var(--bg1)',
      borderRight: '0.5px solid var(--border)', display: 'flex',
      flexDirection: 'column', padding: '28px 16px 24px',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      <div style={{ fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:22, color:'var(--gold-ink)', letterSpacing:'-0.5px', marginBottom:32, paddingLeft:4 }}>
        NEXUS
      </div>
      <nav style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href === '/estatisticas' && (path === '/evolucao' || path === '/dashboard' || path === '/progresso'))
          return (
            <Link key={href} href={href} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'11px 14px', borderRadius:12, textDecoration:'none',
              background: active ? 'rgba(232,168,56,.10)' : 'transparent',
              color:      active ? 'var(--gold)' : 'var(--text2)',
              border:     active ? '0.5px solid rgba(232,168,56,.20)' : '0.5px solid transparent',
              fontSize:14, fontFamily:'var(--font-dm)', transition:'all .15s',
            }}>
              <Icon active={active} />{label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function Ico({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke={active ? 'var(--gold)' : 'var(--text3)'} strokeWidth="1.8" style={{ flexShrink:0 }}>{children}</svg>
  )
}
function HomeIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ico>
}
function CalIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>
}
function CheckIcon({ active }: { active: boolean }) {
  return <Ico active={active}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6"/><path d="M8 12l1.5 1.5L12 11"/><path d="M13.5 12H16"/><path d="M8 16l1.5 1.5L12 15"/><path d="M13.5 16H16"/></Ico>
}
function ActivityIcon({ active }: { active: boolean }) {
  return <Ico active={active}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ico>
}
function EuroIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 10h12M4 14h12M15.5 4.5a9 9 0 1 1 0 15"/></Ico>
}
function TargetIcon({ active }: { active: boolean }) {
  return <Ico active={active}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Ico>
}
function UserIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>
}

function BodyIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M9 6V4a3 3 0 0 1 6 0v2"/><path d="M8 10a4 4 0 1 1 8 0c0 1.8-.6 3.1-1.8 4.2L12 16l-2.2-1.8C8.6 13.1 8 11.8 8 10Z"/><path d="M12 16v5"/><path d="M8.5 21h7"/></Ico>
}


function BookIcon({ active }: { active: boolean }) {
  return <Ico active={active}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23z"/><path d="M8 7h8"/><path d="M8 11h8"/></Ico>
}
