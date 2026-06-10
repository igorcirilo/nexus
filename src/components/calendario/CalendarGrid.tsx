'use client'

import type { ComponentProps, CSSProperties } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, endOfWeek } from 'date-fns'
import { pt } from 'date-fns/locale'
import Icon from '@/components/ui/Icon'
import DayPanel from '@/components/calendario/DayPanel'
import {
  DAYS_MIN,
  DAYS_SHORT,
  describeDayStatus,
  getStreakSide,
  heatColor,
  heatTextColor,
  streakBarStyle,
  type AgendaEvent,
  type Checkin,
  type DayStatus,
  type HabitRow,
  type ViewMode,
} from '@/components/calendario/types'

interface CalendarGridProps {
  viewMode: ViewMode
  current: Date
  weekStart: Date
  dayMap: Record<string, DayStatus>
  selected: string | null
  events: AgendaEvent[]
  today: string
  currentStreak: number
  onViewModeChange: (mode: ViewMode) => void
  onChangeMonth: (dir: 1 | -1) => void
  onChangeWeek: (dir: 1 | -1) => void
  onSelectDay: (dateStr: string) => void
  dayPanelProps: Omit<ComponentProps<typeof DayPanel>, 'dateStr'>
}

export default function CalendarGrid({
  viewMode,
  current,
  weekStart,
  dayMap,
  selected,
  events,
  today,
  currentStreak,
  onViewModeChange,
  onChangeMonth,
  onChangeWeek,
  onSelectDay,
  dayPanelProps,
}: CalendarGridProps) {
  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad = getDay(startOfMonth(current))
  const doneDays = Object.values(dayMap).filter(day => day.complete).length
  const partialDays = Object.values(dayMap).filter(day => !day.complete && (day.checkins > 0 || day.habits > 0)).length
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })

  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Completos', value: doneDays, color: 'var(--teal)' },
          { label: 'Parciais', value: partialDays, color: 'var(--accent)' },
          { label: '% do mês', value: days.length > 0 ? `${Math.round((doneDays / days.length) * 100)}%` : '0%', color: 'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 3, gap: 2, border: '0.5px solid var(--border)', marginBottom: 14 }}>
        {([
          { key: 'month' as ViewMode, label: 'Mês', icon: 'calendar' as const },
          { key: 'week' as ViewMode, label: 'Semana', icon: 'list' as const },
        ]).map(option => (
          <button
            key={option.key}
            type="button"
            onClick={() => onViewModeChange(option.key)}
            aria-pressed={viewMode === option.key}
            style={{
              flex: 1,
              minHeight: 44,
              padding: '7px 0',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === option.key ? 'var(--bg1)' : 'transparent',
              color: viewMode === option.key ? 'var(--teal)' : 'var(--text3)',
              fontSize: 12,
              fontFamily: 'Syne, sans-serif',
              fontWeight: viewMode === option.key ? 700 : 400,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              touchAction: 'manipulation',
            }}
          >
            <Icon name={option.icon} size={15} color="currentColor" />
            {option.label}
          </button>
        ))}
      </div>

      {viewMode === 'month' && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '16px clamp(6px, 2vw, 16px)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={() => onChangeMonth(-1)} aria-label="Mês anterior" style={arrowButtonStyle}>
              <Icon name="chevron-left" size={19} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>{format(current, 'MMMM yyyy', { locale: pt })}</div>
              {currentStreak >= 1 && (
                <div style={{ fontSize: 11, marginTop: 3, color: currentStreak >= 7 ? 'var(--gold)' : currentStreak >= 3 ? 'var(--teal)' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon name="flame" size={13} color="currentColor" />
                  {currentStreak === 1 ? '1 dia de sequência' : `${currentStreak} dias seguidos`}
                </div>
              )}
            </div>
            <button type="button" onClick={() => onChangeMonth(1)} aria-label="Próximo mês" style={arrowButtonStyle}>
              <Icon name="chevron-right" size={19} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(44px, 1fr))', gap: 4, marginBottom: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {DAYS_SHORT.map(day => <div key={day} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', paddingBottom: 6, fontWeight: 600, letterSpacing: '.02em' }}>{day}</div>)}
            {Array.from({ length: startPad }).map((_, index) => <div key={`pad-${index}`} />)}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const isCurrentDay = isToday(day)
              const isSelected = selected === dateStr
              const future = day > new Date()
              const status = dayMap[dateStr]
              const hasEvents = events.some(event => event.date === dateStr)
              const background = isSelected ? 'rgba(127,119,221,.25)' : heatColor(status)
              const side = future ? null : getStreakSide(dateStr, dayMap)
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onSelectDay(dateStr)}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: pt })}: ${describeDayStatus(status, hasEvents)}`}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    background,
                    outline: isCurrentDay ? '2px solid var(--gold)' : isSelected ? '1.5px solid rgba(127,119,221,.6)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: future ? 0.25 : 1,
                    transition: 'all .15s',
                    position: 'relative',
                    overflow: 'hidden',
                    touchAction: 'manipulation',
                  }}
                >
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: isCurrentDay ? 700 : 500, fontSize: 14, color: heatTextColor(status, isCurrentDay, isSelected), lineHeight: 1 }}>{format(day, 'd')}</span>
                  {(status?.checkins > 0 || status?.habits > 0 || hasEvents) && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {status?.checkins > 0 && <div data-calendar-indicator="true" style={{ width: 6, height: 6, borderRadius: '50%', background: status.complete ? 'var(--bg0)' : 'var(--accent)' }} />}
                      {status?.habits > 0 && <div data-calendar-indicator="true" style={{ width: 6, height: 6, borderRadius: '50%', background: status.complete ? 'var(--bg0)' : 'var(--gold)' }} />}
                      {hasEvents && <div data-calendar-indicator="true" style={{ width: 6, height: 6, borderRadius: '50%', background: status?.complete ? 'var(--bg0)' : 'var(--teal)' }} />}
                    </div>
                  )}
                  {side && <div style={streakBarStyle(side)} />}
                </button>
              )
            })}
          </div>
          <CalendarLegend />
        </div>
      )}

      {viewMode === 'week' && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '16px clamp(6px, 2vw, 16px)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={() => onChangeWeek(-1)} aria-label="Semana anterior" style={arrowButtonStyle}>
              <Icon name="chevron-left" size={19} />
            </button>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>
              {format(weekStart, 'd MMM', { locale: pt })} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'd MMM', { locale: pt })}
            </span>
            <button type="button" onClick={() => onChangeWeek(1)} aria-label="Próxima semana" style={arrowButtonStyle}>
              <Icon name="chevron-right" size={19} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(44px, 1fr))', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const isCurrentDay = isToday(day)
              const isSelected = selected === dateStr
              const future = day > new Date()
              const status = dayMap[dateStr]
              const dayEvents = events.filter(event => event.date === dateStr)
              const pct = status?.total > 0 ? Math.round((status.habits / status.total) * 100) : 0
              const background = isSelected ? 'rgba(127,119,221,.2)' : heatColor(status)
              const side = future ? null : getStreakSide(dateStr, dayMap)
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onSelectDay(dateStr)}
                  aria-label={`${format(day, "EEEE, d 'de' MMMM", { locale: pt })}: ${describeDayStatus(status, dayEvents.length > 0)}`}
                  style={{
                    minHeight: 84,
                    minWidth: 44,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    padding: '10px 4px',
                    borderRadius: 14,
                    border: 'none',
                    cursor: 'pointer',
                    background,
                    outline: isCurrentDay ? '2px solid var(--gold)' : isSelected ? '1.5px solid var(--accent)' : 'none',
                    opacity: future ? 0.3 : 1,
                    transition: 'all .15s',
                    position: 'relative',
                    overflow: 'hidden',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{ fontSize: 9, color: isCurrentDay ? 'var(--gold)' : 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{DAYS_MIN[getDay(day)]}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: status?.complete ? 'var(--bg0)' : isCurrentDay ? 'var(--gold)' : isSelected ? 'var(--accent)' : 'var(--text1)', lineHeight: 1 }}>{format(day, 'd')}</div>
                  {!future && (
                    <div style={{ width: '100%', padding: '0 2px' }}>
                      <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 100, height: 5 }}>
                        <div style={{ height: '100%', borderRadius: 100, background: status?.complete ? 'var(--bg0)' : 'var(--teal)', width: `${pct}%`, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )}
                  {dayEvents.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {dayEvents.slice(0, 3).map(event => <div key={event.id} data-calendar-indicator="true" style={{ width: 6, height: 6, borderRadius: '50%', background: event.color }} />)}
                    </div>
                  )}
                  {side && <div style={streakBarStyle(side)} />}
                </button>
              )
            })}
          </div>
          {selected && weekDays.some(day => format(day, 'yyyy-MM-dd') === selected) && (
            <DayPanel dateStr={selected} {...dayPanelProps} />
          )}
        </div>
      )}

      {viewMode === 'month' && selected && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid rgba(127,119,221,.22)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <DayPanel dateStr={selected} {...dayPanelProps} />
        </div>
      )}
    </div>
  )
}

const arrowButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: 'var(--bg3)',
  border: '0.5px solid var(--border)',
  cursor: 'pointer',
  color: 'var(--text2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
} satisfies CSSProperties

function CalendarLegend() {
  return (
    <div style={{ paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 5 }}>Intensidade de hábitos</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Nenhum</span>
            {['transparent', 'rgba(30,203,180,.14)', 'rgba(30,203,180,.28)', 'rgba(30,203,180,.45)', 'rgba(30,203,180,.65)', 'var(--teal)'].map((color, index) => (
              <div key={index} style={{ width: 15, height: 15, borderRadius: 4, background: color, border: '0.5px solid var(--border)' }} />
            ))}
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Completo</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 5 }}>Sequência</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <div style={{ width: 26, height: 3, borderRadius: 3, background: 'rgba(30,203,180,.8)' }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>streak</span>
          </div>
        </div>
      </div>
    </div>
  )
}
