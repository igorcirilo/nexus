'use client'

import Nav from '@/components/Nav'
import Icon, { type IconName } from '@/components/ui/Icon'
import CalendarGrid from '@/components/calendario/CalendarGrid'
import CheckinTab from '@/components/calendario/CheckinTab'
import RemindersTab from '@/components/calendario/RemindersTab'
import AgendaTab from '@/components/calendario/AgendaTab'
import CalendarioLoading from '@/components/calendario/CalendarioLoading'
import { useCalendarioController } from '@/components/calendario/useCalendarioController'
import type { CalendarTab } from '@/components/calendario/types'

const TABS: { key: CalendarTab; label: string; icon: IconName }[] = [
  { key: 'calendario', label: 'Calendário', icon: 'calendar' },
  { key: 'checkin', label: 'Check-in', icon: 'check' },
  { key: 'lembretes', label: 'Alertas', icon: 'bell' },
  { key: 'agenda', label: 'Agenda', icon: 'list' },
]

export default function CalendarioPage() {
  const controller = useCalendarioController()

  if (controller.loading) return <CalendarioLoading />

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      {controller.toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)', zIndex: 200, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="check" size={14} />
          {controller.toast}
        </div>
      )}

      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Calendário</h1>
        <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 14, padding: 4, gap: 3, border: '0.5px solid var(--border)' }}>
          {TABS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => controller.setTab(item.key)}
              aria-label={item.label}
              aria-pressed={controller.tab === item.key}
              style={{ flex: 1, minHeight: 54, padding: '8px 3px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: controller.tab === item.key ? 'var(--bg1)' : 'transparent', color: controller.tab === item.key ? 'var(--gold)' : 'var(--text3)', transition: 'all .15s', fontSize: 9, fontFamily: 'Syne, sans-serif', fontWeight: controller.tab === item.key ? 600 : 400, position: 'relative', touchAction: 'manipulation' }}
            >
              <Icon name={item.icon} size={16} color="currentColor" />
              {item.label}
              {item.key === 'agenda' && controller.events.length > 0 && <span style={{ position: 'absolute', top: 4, right: 6, background: 'var(--gold)', color: 'var(--bg0)', borderRadius: 999, fontSize: 8, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>{controller.events.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {controller.tab === 'calendario' && <CalendarGrid {...controller.calendarGridProps} />}
      {controller.tab === 'checkin' && <CheckinTab {...controller.checkinTabProps} />}
      {controller.tab === 'lembretes' && <RemindersTab {...controller.remindersTabProps} />}
      {controller.tab === 'agenda' && <AgendaTab {...controller.agendaTabProps} />}

      <Nav />
    </main>
  )
}
