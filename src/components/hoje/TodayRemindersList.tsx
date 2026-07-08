'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { TodayReminderItem } from '@/lib/today-reminders'

interface TodayRemindersListProps {
  items: TodayReminderItem[]
  onToggle: (item: TodayReminderItem, done: boolean) => Promise<void> | void
  onAdd: () => void
}

export default function TodayRemindersList({ items, onToggle, onAdd }: TodayRemindersListProps) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const doneCount = items.filter((i) => i.done).length

  async function toggle(item: TodayReminderItem) {
    if (savingKey) return
    setSavingKey(item.key)
    try {
      await onToggle(item, !item.done)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section
      id="lembretes-hoje"
      aria-label={`Lembretes de hoje: ${doneCount} de ${items.length} concluídos`}
      style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}
    >
      <div
        style={{
          display: 'grid',
          gap: 10,
          padding: 16,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
          border: '0.5px solid var(--border)',
          boxShadow: '0 14px 40px rgba(0,0,0,.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2, color: 'var(--text1)' }}>
            Lembretes de hoje
          </h2>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Adicionar lembrete de hoje"
            style={{
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 14,
              background: 'transparent',
              color: 'var(--teal)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <Icon name="plus" size={20} />
          </button>
        </div>

        {items.map((item) => {
          const isSaving = savingKey === item.key
          const isBusy = savingKey !== null
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item)}
              disabled={isBusy}
              aria-pressed={item.done}
              aria-busy={isSaving}
              aria-label={`${item.done ? 'Desmarcar' : 'Concluir'} lembrete ${item.title}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '12px 10px',
                borderRadius: 15,
                background: 'rgba(13,15,20,.2)',
                border: `0.5px solid ${item.done ? 'rgba(30,203,180,.3)' : 'var(--border)'}`,
                borderLeft: `3px solid ${item.color}`,
                opacity: item.done ? 0.62 : isBusy && !isSaving ? 0.5 : 1,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                minHeight: 44,
                touchAction: 'manipulation',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: item.done ? 'none' : '2px solid var(--text3)',
                  color: 'var(--teal)',
                  background: item.done ? 'rgba(30,203,180,.12)' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.done && <Icon name="check" size={16} />}
              </span>
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1.22,
                    color: item.done ? 'var(--text3)' : 'var(--text1)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    marginBottom: 4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item.title}
                </h3>
                <div style={{ display: 'flex', gap: 7, fontSize: 13, minWidth: 0, alignItems: 'center' }}>
                  <span style={{ color: item.color, fontWeight: 600, flexShrink: 0 }}>
                    {item.itemType === 'event' ? 'Agenda' : 'Lembrete'}
                  </span>
                  <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>
                  <span style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.time ?? 'Todo o dia'}
                  </span>
                </div>
              </div>
            </button>
          )
        })}

        {items.length === 0 && (
          <div style={{ padding: 18, borderRadius: 16, background: 'rgba(13,15,20,.2)', border: '0.5px solid var(--border)', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Sem lembretes ou eventos para hoje.
            <button
              type="button"
              onClick={onAdd}
              style={{
                minHeight: 44,
                marginTop: 12,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
                color: 'var(--on-bright)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              Adicionar
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
