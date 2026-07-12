'use client'

import { useEffect, useState } from 'react'
import type { HabitArea } from '@/types'
import BottomSheet from '@/components/ui/BottomSheet'
import Icon from '@/components/ui/Icon'

const AREAS: Array<{ key: HabitArea; label: string; color: string }> = [
  { key: 'produtividade', label: 'Produtividade', color: 'var(--accent)' },
  { key: 'corpo', label: 'Corpo', color: 'var(--teal)' },
  { key: 'emocoes', label: 'Emoções', color: 'var(--gold)' },
  { key: 'carreira', label: 'Carreira', color: 'var(--gold)' },
  { key: 'idiomas', label: 'Idiomas', color: 'var(--accent)' },
  { key: 'financas', label: 'Finanças', color: 'var(--teal)' },
  { key: 'relacionamentos', label: 'Relações', color: 'var(--accent)' },
]

interface AddTaskSheetProps {
  open: boolean
  saving?: boolean
  onClose: () => void
  onCreate: (title: string, area: HabitArea) => Promise<void>
}

export default function AddTaskSheet({ open, saving = false, onClose, onCreate }: AddTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState<HabitArea>('produtividade')

  useEffect(() => {
    if (!open) {
      setTitle('')
      setArea('produtividade')
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    await onCreate(trimmed, area)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Nova tarefa">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Título</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="O que precisa acontecer hoje?"
            autoFocus
            style={{
              width: '100%',
              minHeight: 48,
              border: '0.5px solid var(--border)',
              borderRadius: 14,
              background: 'var(--bg2)',
              color: 'var(--text1)',
              padding: '0 14px',
              outline: 'none',
              fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
              fontSize: 15,
            }}
          />
        </label>

        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Área</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AREAS.map(option => {
              const selected = area === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setArea(option.key)}
                  aria-pressed={selected}
                  style={{
                    minHeight: 44,
                    border: selected ? `1px solid ${option.color}` : '0.5px solid var(--border)',
                    borderRadius: 12,
                    background: selected ? 'rgba(127,119,221,.14)' : 'var(--bg2)',
                    color: selected ? option.color : 'var(--text2)',
                    padding: '0 12px',
                    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                    fontWeight: 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || saving}
          style={{
            minHeight: 50,
            border: 'none',
            borderRadius: 14,
            background: 'var(--gold)',
            color: 'var(--on-bright)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: !title.trim() || saving ? 'not-allowed' : 'pointer',
            opacity: !title.trim() || saving ? 0.58 : 1,
            touchAction: 'manipulation',
          }}
        >
          <Icon name="plus" size={16} />
          {saving ? 'Criando...' : 'Criar tarefa'}
        </button>
      </form>
    </BottomSheet>
  )
}
