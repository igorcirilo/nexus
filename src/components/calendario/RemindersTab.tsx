'use client'

import Icon, { type IconName } from '@/components/ui/Icon'
import { inputStyle, type Reminder } from '@/components/calendario/types'

interface RemindersTabProps {
  reminders: Reminder[]
  showForm: boolean
  title: string
  time: string
  days: number[]
  type: string
  saving: boolean
  onOpenForm: () => void
  onCloseForm: () => void
  onTitleChange: (value: string) => void
  onTimeChange: (value: string) => void
  onDaysChange: (updater: (days: number[]) => number[]) => void
  onTypeChange: (value: string) => void
  onSave: () => void
  onToggle: (id: string, active: boolean) => void
  onRemove: (id: string) => void
}

export default function RemindersTab({
  reminders,
  showForm,
  title,
  time,
  days,
  type,
  saving,
  onOpenForm,
  onCloseForm,
  onTitleChange,
  onTimeChange,
  onDaysChange,
  onTypeChange,
  onSave,
  onToggle,
  onRemove,
}: RemindersTabProps) {
  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{reminders.filter(reminder => reminder.active).length} activos</div>
        <button type="button" onClick={onOpenForm} style={primarySmallButton}>
          + Novo
        </button>
      </div>

      {reminders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text3)' }}>
            <Icon name="bell" size={34} />
          </div>
          Sem lembretes ainda.
        </div>
      )}

      {reminders.map(reminder => (
        <div key={reminder.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 14, marginBottom: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)', opacity: reminder.active ? 1 : 0.5 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg3)', color: reminder.active ? 'var(--gold)' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={iconForReminder(reminder.type)} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 3 }}>{reminder.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{reminder.time?.slice(0, 5)}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                  <span key={index} style={{ width: 16, height: 16, borderRadius: 4, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: reminder.days?.includes(index) ? 'var(--accent)' : 'var(--bg3)', color: reminder.days?.includes(index) ? 'white' : 'var(--text3)' }}>{day}</span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggle(reminder.id, reminder.active)}
            aria-label={reminder.active ? `Desativar lembrete ${reminder.title}` : `Ativar lembrete ${reminder.title}`}
            style={{ width: 48, height: 44, borderRadius: 100, border: 'none', cursor: 'pointer', background: reminder.active ? 'var(--teal)' : 'var(--bg3)', position: 'relative', transition: 'background .2s', flexShrink: 0, touchAction: 'manipulation' }}
          >
            <div style={{ position: 'absolute', top: 14, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', left: reminder.active ? 'calc(100% - 22px)' : '6px' }} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(reminder.id)}
            aria-label={`Remover lembrete ${reminder.title}`}
            style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }} onClick={event => event.target === event.currentTarget && onCloseForm()}>
          <div style={{ width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '0.5px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>Novo lembrete</h2>
              <button type="button" onClick={onCloseForm} aria-label="Fechar novo lembrete" style={iconButtonStyle}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <label style={labelStyle}>Título</label>
            <input value={title} onChange={event => onTitleChange(event.target.value)} placeholder="Ex: Check-in da manhã" style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Hora</label>
                <input type="time" value={time} onChange={event => onTimeChange(event.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={type} onChange={event => onTypeChange(event.target.value)} style={inputStyle}>
                  <option value="checkin_manha">Manhã</option>
                  <option value="checkin_tarde">Tarde</option>
                  <option value="checkin_noite">Noite</option>
                  <option value="habito">Hábito</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
            </div>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Dias</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onDaysChange(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])}
                  aria-pressed={days.includes(index)}
                  aria-label={`Alternar ${day} do lembrete`}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '9px 0',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    background: days.includes(index) ? 'var(--accent)' : 'var(--bg2)',
                    color: days.includes(index) ? 'white' : 'var(--text3)',
                    outline: days.includes(index) ? 'none' : '0.5px solid var(--border)',
                    touchAction: 'manipulation',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
            <button type="button" onClick={onSave} disabled={saving || !title.trim()} style={{ width: '100%', minHeight: 44, background: title.trim() ? 'var(--gold)' : 'var(--bg3)', color: title.trim() ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', touchAction: 'manipulation' }}>
              {saving ? 'A guardar…' : 'Guardar lembrete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function iconForReminder(type: string): IconName {
  if (type === 'checkin_manha') return 'sunrise'
  if (type === 'checkin_tarde') return 'sun'
  if (type === 'checkin_noite') return 'moon'
  if (type === 'habito') return 'check'
  return 'bell'
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
  color: 'var(--text2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
}
