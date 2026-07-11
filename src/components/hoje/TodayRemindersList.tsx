'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'
import SwipeRow from '@/components/ui/SwipeRow'
import { isOverdue, type TodayReminderItem } from '@/lib/today-reminders'

/**
 * Lista "Lembretes de hoje" ao estilo do app Lembretes do iOS, no formato
 * Nexus: linhas com separador fino num só card, círculo de check que
 * preenche na cor do item, concluídos agrupados num bloco colapsável,
 * swipe para a esquerda (apagar/editar) e adição inline no fim da lista.
 */

interface TodayRemindersListProps {
  items: TodayReminderItem[]
  onToggle: (item: TodayReminderItem, done: boolean) => Promise<void> | void
  /** Cria um item avulso de hoje; devolve true em sucesso (limpa o input). */
  onCreate: (title: string, time: string | null) => Promise<boolean>
  /** Swipe direita→esquerda: apagar o item (evento ou lembrete recorrente). */
  onDelete: (item: TodayReminderItem) => Promise<void> | void
  /** Swipe esquerda→direita ou toque na linha: abre a página onde se edita. */
  onEdit: (item: TodayReminderItem) => void
}

/** Tempo que o item riscado fica no lugar antes de descer para Concluídos. */
const COMPLETE_LINGER_MS = 1300

const hairline: React.CSSProperties = { height: 0.5, background: 'var(--border)', marginLeft: 48 }

export default function TodayRemindersList({ items, onToggle, onCreate, onDelete, onEdit }: TodayRemindersListProps) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // Itens acabados de concluir ficam uns instantes na lista antes de "descer".
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)
  const [openSwipe, setOpenSwipe] = useState<{ key: string; side: 'left' | 'right' } | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Adição inline (à la iOS: escreve, Enter cria, continua a escrever).
  const [addTitle, setAddTitle] = useState('')
  const [addTime, setAddTime] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  const now = new Date()
  const pending = items.filter((i) => !i.done || justCompleted.has(i.key))
  const completed = items.filter((i) => i.done && !justCompleted.has(i.key))
  const remaining = items.filter((i) => !i.done).length

  async function toggle(item: TodayReminderItem) {
    if (savingKey) return
    setSavingKey(item.key)
    try {
      const done = !item.done
      if (done) {
        // Mantém o item riscado no lugar por uns instantes (feedback iOS).
        setJustCompleted((prev) => new Set(prev).add(item.key))
        timersRef.current.push(setTimeout(() => {
          setJustCompleted((prev) => {
            const next = new Set(prev)
            next.delete(item.key)
            return next
          })
        }, COMPLETE_LINGER_MS))
      }
      await onToggle(item, done)
    } finally {
      setSavingKey(null)
    }
  }

  async function submitAdd() {
    const title = addTitle.trim()
    if (!title || addSaving) return
    setAddSaving(true)
    try {
      const ok = await onCreate(title, addTime || null)
      if (ok) {
        setAddTitle('')
        setAddTime('')
        addInputRef.current?.focus()
      }
    } finally {
      setAddSaving(false)
    }
  }

  function renderRow(item: TodayReminderItem, faded: boolean) {
    const overdue = !item.done && isOverdue(item.time, now)
    return (
      <SwipeRow
        key={item.key}
        open={openSwipe?.key === item.key ? openSwipe.side : null}
        onOpenChange={(side) => setOpenSwipe(side ? { key: item.key, side } : (openSwipe?.key === item.key ? null : openSwipe))}
        leftAction={{ label: 'Editar', color: 'var(--accent)', onAction: () => { setOpenSwipe(null); onEdit(item) } }}
        rightAction={{ label: 'Apagar', color: '#E24B4A', onAction: () => { setOpenSwipe(null); void onDelete(item) } }}
        onClickRow={() => onEdit(item)}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0,1fr)',
            alignItems: 'center',
            gap: 13,
            padding: '11px 6px 11px 2px',
            minHeight: 48,
            opacity: faded ? 0.55 : 1,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void toggle(item) }}
            disabled={savingKey !== null}
            aria-pressed={item.done}
            aria-label={`${item.done ? 'Desmarcar' : 'Concluir'} ${item.title}`}
            style={{
              width: 33,
              height: 33,
              borderRadius: '50%',
              border: item.done ? `2px solid ${item.color}` : '2px solid var(--text3)',
              background: item.done ? item.color : 'transparent',
              color: 'var(--on-bright)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: savingKey ? 'wait' : 'pointer',
              padding: 0,
              transition: 'background .15s ease, border-color .15s ease',
              touchAction: 'manipulation',
            }}
          >
            {item.done && <Icon name="check" size={15} />}
          </button>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontWeight: 600,
                fontSize: 15.5,
                lineHeight: 1.25,
                color: item.done ? 'var(--text3)' : 'var(--text1)',
                textDecoration: item.done ? 'line-through' : 'none',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflowWrap: 'anywhere',
                transition: 'color .15s ease',
              }}
            >
              {item.title}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, marginTop: 2, minWidth: 0 }}>
              <span style={{ color: overdue ? '#E24B4A' : 'var(--text3)', fontWeight: overdue ? 700 : 400, flexShrink: 0 }}>
                {item.time ?? 'Todo o dia'}
              </span>
              <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>
              <span style={{ color: item.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.itemType === 'event' ? 'Agenda' : 'Lembrete'}
              </span>
              {item.carriedFromDate && (
                <>
                  <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600, flexShrink: 0 }}>
                    desde {new Date(`${item.carriedFromDate}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </SwipeRow>
    )
  }

  return (
    <section
      id="lembretes-hoje"
      aria-label={`Lembretes de hoje: ${remaining} por fazer`}
      style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}
    >
      <div
        style={{
          padding: '16px 16px 8px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
          border: '0.5px solid var(--border)',
          boxShadow: '0 14px 40px rgba(0,0,0,.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2, color: 'var(--text1)' }}>
            Lembretes de hoje
          </h2>
          <span style={{ fontSize: 12.5, color: 'var(--text3)', fontFamily: 'var(--font-dm), "DM Sans", sans-serif' }}>
            {remaining > 0 ? `${remaining} por fazer` : items.length > 0 ? 'tudo feito ✓' : ''}
          </span>
        </div>

        {pending.map((item, idx) => (
          <div key={item.key}>
            {idx > 0 && <div style={hairline} />}
            {renderRow(item, false)}
          </div>
        ))}

        {pending.length === 0 && completed.length === 0 && (
          <div style={{ padding: '10px 2px 6px', color: 'var(--text3)', fontSize: 13 }}>
            Sem lembretes para hoje.
          </div>
        )}

        {/* Adição inline, sempre no fim da lista (como no iOS). */}
        <div style={{ ...(pending.length > 0 ? { borderTop: '0.5px solid var(--border)' } : {}) }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 13, padding: '11px 6px 11px 2px', minHeight: 48 }}>
            <span
              aria-hidden
              style={{
                width: 33, height: 33, borderRadius: '50%',
                border: '2px dashed var(--text3)', opacity: 0.55,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', flexShrink: 0,
              }}
            >
              <Icon name="plus" size={14} />
            </span>
            <input
              ref={addInputRef}
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void submitAdd() }
                if (e.key === 'Escape') { setAddTitle(''); setAddTime('') }
              }}
              placeholder="Novo lembrete…"
              aria-label="Novo lembrete de hoje"
              disabled={addSaving}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--text1)', fontSize: 15.5, minWidth: 0, width: '100%',
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 600,
                opacity: addSaving ? 0.6 : 1,
              }}
            />
            {addTitle.trim() ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  aria-label="Hora (opcional)"
                  style={{
                    border: '0.5px solid var(--border)', borderRadius: 9,
                    background: 'var(--bg2)', color: addTime ? 'var(--text1)' : 'var(--text3)',
                    fontSize: 12.5, padding: '5px 7px', outline: 'none',
                    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void submitAdd()}
                  disabled={addSaving}
                  aria-label="Criar lembrete"
                  style={{
                    minWidth: 40, minHeight: 33, border: 'none', borderRadius: 10,
                    background: 'var(--gold)', color: 'var(--on-bright)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: addSaving ? 'wait' : 'pointer', touchAction: 'manipulation',
                  }}
                >
                  <Icon name="check" size={15} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Concluídos — grupo colapsável no fim, como no iOS. */}
        {completed.length > 0 && (
          <div style={{ borderTop: '0.5px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '11px 6px 11px 2px', minHeight: 44,
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text3)', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif', touchAction: 'manipulation',
              }}
            >
              <span>Concluídos · {completed.length}</span>
              <span>{showCompleted ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            {showCompleted && completed.map((item) => (
              <div key={item.key}>
                <div style={hairline} />
                {renderRow(item, true)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
