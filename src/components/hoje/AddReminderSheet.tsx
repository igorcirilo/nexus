'use client'

import { useEffect, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Icon from '@/components/ui/Icon'

interface AddReminderSheetProps {
  open: boolean
  saving?: boolean
  onClose: () => void
  /** Cria um item avulso para hoje; time null = dia inteiro. */
  onCreate: (title: string, time: string | null) => Promise<void>
}

const inputStyle: React.CSSProperties = {
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
}

export default function AddReminderSheet({ open, saving = false, onClose, onCreate }: AddReminderSheetProps) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    if (!open) {
      setTitle('')
      setTime('')
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    await onCreate(trimmed, time || null)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Novo lembrete de hoje">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="O que precisas de resolver hoje?"
            autoFocus
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Hora (opcional)</span>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            style={inputStyle}
          />
        </label>

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
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: !title.trim() || saving ? 'not-allowed' : 'pointer',
            opacity: !title.trim() || saving ? 0.58 : 1,
            touchAction: 'manipulation',
          }}
        >
          <Icon name="plus" size={16} />
          {saving ? 'A criar…' : 'Criar lembrete'}
        </button>
      </form>
    </BottomSheet>
  )
}
