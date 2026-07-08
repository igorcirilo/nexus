'use client'

import { useEffect, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'

interface EventEditSheetProps {
  open: boolean
  initialTitle: string
  /** 'HH:MM' ou null (dia inteiro). */
  initialTime: string | null
  saving?: boolean
  onClose: () => void
  onSave: (title: string, time: string | null) => Promise<void>
  onDelete: () => Promise<void>
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

/** Edição de um item avulso de hoje (evento da agenda): título, hora, apagar. */
export default function EventEditSheet({ open, initialTitle, initialTime, saving = false, onClose, onSave, onDelete }: EventEditSheetProps) {
  const [title, setTitle] = useState(initialTitle)
  const [time, setTime] = useState(initialTime ?? '')

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setTime(initialTime ?? '')
    }
  }, [open, initialTitle, initialTime])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    await onSave(trimmed, time || null)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Editar lembrete">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={inputStyle} />
        </label>

        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Hora (vazio = dia inteiro)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
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
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: !title.trim() || saving ? 'not-allowed' : 'pointer',
            opacity: !title.trim() || saving ? 0.58 : 1,
            touchAction: 'manipulation',
          }}
        >
          {saving ? 'A guardar…' : 'Guardar'}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => void onDelete()}
          style={{
            minHeight: 46,
            border: '0.5px solid rgba(226,75,74,.4)',
            borderRadius: 14,
            background: 'transparent',
            color: '#E24B4A',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Apagar lembrete
        </button>
      </form>
    </BottomSheet>
  )
}
