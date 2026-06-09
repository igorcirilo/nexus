'use client'

import { format, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import Icon from '@/components/ui/Icon'
import { EVENT_COLORS, inputStyle, type AgendaEvent, type Recurrence } from '@/components/calendario/types'

interface AgendaTabProps {
  events: AgendaEvent[]
  current: Date
  showForm: boolean
  title: string
  description: string
  date: string
  time: string
  endTime: string
  color: string
  allDay: boolean
  recurrence: Recurrence
  saving: boolean
  onOpenForm: () => void
  onCloseForm: () => void
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onColorChange: (value: string) => void
  onAllDayChange: (value: boolean) => void
  onRecurrenceChange: (value: Recurrence) => void
  onSave: () => void
  onRemoveEvent: (id: string) => void
}

export default function AgendaTab({
  events,
  current,
  showForm,
  title,
  description,
  date,
  time,
  endTime,
  color,
  allDay,
  recurrence,
  saving,
  onOpenForm,
  onCloseForm,
  onTitleChange,
  onDescriptionChange,
  onDateChange,
  onTimeChange,
  onEndTimeChange,
  onColorChange,
  onAllDayChange,
  onRecurrenceChange,
  onSave,
  onRemoveEvent,
}: AgendaTabProps) {
  const groupedEvents = Object.entries(
    events.reduce((acc: Record<string, AgendaEvent[]>, event) => {
      if (!acc[event.date]) acc[event.date] = []
      acc[event.date].push(event)
      return acc
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{events.length} evento{events.length !== 1 ? 's' : ''} em {format(current, 'MMMM', { locale: pt })}</div>
        <button type="button" onClick={onOpenForm} style={primarySmallButton}>
          + Evento
        </button>
      </div>

      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text3)' }}>
            <Icon name="list" size={34} />
          </div>
          Sem eventos este mês.
        </div>
      )}

      {groupedEvents.map(([eventDate, dayEvents]) => (
        <div key={eventDate} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginBottom: 6 }}>
            {format(new Date(`${eventDate}T12:00:00`), "EEEE, d 'de' MMMM", { locale: pt })}
            {isToday(new Date(`${eventDate}T12:00:00`)) && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--gold)', background: 'rgba(232,168,56,.1)', padding: '2px 8px', borderRadius: 6 }}>Hoje</span>}
          </div>
          {dayEvents.map(event => (
            <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, marginBottom: 6, background: 'var(--bg2)', border: `0.5px solid ${event.color}40` }}>
              <div style={{ width: 3, height: 40, borderRadius: 2, background: event.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 2 }}>{event.title}</div>
                {!event.all_day && event.time && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{event.time.slice(0, 5)}{event.end_time ? ` – ${event.end_time.slice(0, 5)}` : ''}</div>}
                {event.all_day && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Dia inteiro</div>}
                {event.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{event.description}</div>}
              </div>
              <button
                type="button"
                onClick={() => onRemoveEvent(event.id)}
                aria-label={`Remover evento ${event.title}`}
                style={iconButtonStyle}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      ))}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }} onClick={event => event.target === event.currentTarget && onCloseForm()}>
          <div style={{ width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '24px 24px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>Novo evento</h2>
                <button type="button" onClick={onCloseForm} aria-label="Fechar novo evento" style={iconButtonStyle}>
                  <Icon name="x" size={16} />
                </button>
              </div>
              <label style={labelStyle}>Título</label>
              <input value={title} onChange={event => onTitleChange(event.target.value)} placeholder="Ex: Consulta, Reunião, Treino…" style={{ ...inputStyle, marginBottom: 12 }} />
              <label style={labelStyle}>Descrição (opcional)</label>
              <input value={description} onChange={event => onDescriptionChange(event.target.value)} placeholder="Notas" style={{ ...inputStyle, marginBottom: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input type="date" value={date} onChange={event => onDateChange(event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Início</label>
                  <input type="time" value={time} onChange={event => onTimeChange(event.target.value)} style={inputStyle} disabled={allDay} />
                </div>
                <div>
                  <label style={labelStyle}>Fim</label>
                  <input type="time" value={endTime} onChange={event => onEndTimeChange(event.target.value)} style={inputStyle} disabled={allDay} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => onAllDayChange(!allDay)}
                  aria-label={allDay ? 'Desativar evento de dia inteiro' : 'Ativar evento de dia inteiro'}
                  aria-pressed={allDay}
                  style={{ width: 48, height: 44, borderRadius: 100, border: 'none', cursor: 'pointer', background: allDay ? 'var(--teal)' : 'var(--bg3)', position: 'relative', transition: 'background .2s', touchAction: 'manipulation' }}
                >
                  <div style={{ position: 'absolute', top: 14, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', left: allDay ? 'calc(100% - 22px)' : '6px' }} />
                </button>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Dia inteiro</span>
              </div>

              <label style={{ ...labelStyle, marginBottom: 8 }}>Recorrência</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {([
                  { key: 'none' as Recurrence, label: 'Não repete', icon: 'check' as const },
                  { key: 'semanal' as Recurrence, label: 'Semanal · 12×', icon: 'calendar' as const },
                  { key: 'mensal' as Recurrence, label: 'Mensal · 6×', icon: 'list' as const },
                ]).map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onRecurrenceChange(option.key)}
                    aria-pressed={recurrence === option.key}
                    style={{
                      flex: 1,
                      minHeight: 58,
                      padding: '9px 4px',
                      borderRadius: 11,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      background: recurrence === option.key ? 'rgba(232,168,56,.12)' : 'var(--bg2)',
                      outline: recurrence === option.key ? '1.5px solid var(--gold)' : '0.5px solid var(--border)',
                      transition: 'all .15s',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Icon name={option.icon} size={16} color={recurrence === option.key ? 'var(--gold)' : 'var(--text3)'} />
                    <span style={{ fontSize: 9, fontFamily: 'Syne, sans-serif', fontWeight: recurrence === option.key ? 700 : 400, color: recurrence === option.key ? 'var(--gold)' : 'var(--text3)', textAlign: 'center' }}>{option.label}</span>
                  </button>
                ))}
              </div>

              <label style={{ ...labelStyle, marginBottom: 8 }}>Cor</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {EVENT_COLORS.map(eventColor => (
                  <button
                    key={eventColor}
                    type="button"
                    onClick={() => onColorChange(eventColor)}
                    aria-label={`Selecionar cor ${eventColor}`}
                    aria-pressed={color === eventColor}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: eventColor, border: 'none', cursor: 'pointer', outline: color === eventColor ? '2.5px solid white' : 'none', touchAction: 'manipulation' }}
                  />
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 24px 48px', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)' }}>
              <button type="button" onClick={onSave} disabled={saving || !title.trim()} style={{ width: '100%', minHeight: 44, background: title.trim() ? 'var(--gold)' : 'var(--bg3)', color: title.trim() ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', touchAction: 'manipulation' }}>
                {saving ? 'A guardar…' : recurrence === 'semanal' ? 'Criar 12 semanas' : recurrence === 'mensal' ? 'Criar 6 meses' : 'Guardar evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  fontSize: 12,
  color: 'var(--text3)',
  display: 'block',
  marginBottom: 6,
}

const primarySmallButton = {
  minHeight: 44,
  background: 'var(--gold)',
  color: 'var(--bg0)',
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  touchAction: 'manipulation',
}

const iconButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'var(--bg3)',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text3)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
}
