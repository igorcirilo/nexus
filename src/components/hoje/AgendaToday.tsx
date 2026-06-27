'use client'

import Icon from '@/components/ui/Icon'
import type { AgendaItem } from '@/lib/home-extras'

interface AgendaTodayProps {
  events: AgendaItem[]
  reminder: { title: string } | null
}

/**
 * "A tua agenda" (trabalhos ORGANIZA + LEMBRA): eventos do calendário de hoje +
 * o próximo lembrete. Só aparece quando há algo.
 */
export default function AgendaToday({ events, reminder }: AgendaTodayProps) {
  if (events.length === 0 && !reminder) return null

  return (
    <section aria-label="Agenda de hoje" style={{ padding: '18px 20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <h2 style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text3)' }}>
          A tua agenda
        </h2>
        <a href="/calendario" style={{ fontSize: 12.5, color: 'var(--teal)', textDecoration: 'none', fontWeight: 700 }}>Abrir agenda</a>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((e, i) => (
          <a
            key={i}
            href="/calendario"
            style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(var(--ink-rgb),.025)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '11px 13px', textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text2)', width: 44, flexShrink: 0 }}>
              {e.time ? e.time.slice(0, 5) : 'dia'}
            </span>
            <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: e.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title}
            </span>
          </a>
        ))}

        {reminder && (
          <a
            href="/lembretes"
            style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(226,75,74,.07)', border: '0.5px solid rgba(226,75,74,.2)', borderRadius: 14, padding: '11px 13px', textDecoration: 'none', color: 'inherit' }}
          >
            <Icon name="bell" size={16} color="#E24B4A" />
            <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 13.5, flex: 1, minWidth: 0 }}>
              {reminder.title}
              <span style={{ display: 'block', fontWeight: 500, color: 'var(--text2)', fontSize: 12, marginTop: 1 }}>Lembrete</span>
            </span>
          </a>
        )}
      </div>
    </section>
  )
}
