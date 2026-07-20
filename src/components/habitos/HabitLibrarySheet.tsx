'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AREA_META } from '@/types'
import type { HabitArea } from '@/types'
import { LIBRARY_BY_AREA, LIBRARY_ALL, searchLibrary } from '@/lib/habit-library'
import type { LibraryHabit } from '@/lib/habit-library'

const FONT = 'Inter, sans-serif'

const AREAS = Object.keys(LIBRARY_BY_AREA) as HabitArea[]

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: 'Fácil', 2: 'Média', 3: 'Difícil' }

interface Props {
  /** Keys (lib_*) já presentes nos hábitos do utilizador — mostrados como "Adicionado". */
  existingKeys: Set<string>
  /** Nomes (normalizados) já existentes — evita duplicar por texto. */
  existingNames: Set<string>
  busyKey: string | null
  onAdd: (habit: LibraryHabit) => void
  onClose: () => void
}

export default function HabitLibrarySheet({ existingKeys, existingNames, busyKey, onAdd, onClose }: Props) {
  const [tab, setTab] = useState<'all' | HabitArea>('all')
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (query.trim()) return searchLibrary(query)
    if (tab === 'all') return LIBRARY_ALL
    return LIBRARY_BY_AREA[tab]
  }, [query, tab])

  function isAdded(h: LibraryHabit): boolean {
    return existingKeys.has(h.key) || existingNames.has(normalize(h.name))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 448,
          margin: '0 auto',
          background: 'var(--surface-card)',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(var(--ink-rgb),0.12)',
          display: 'flex',
          flexDirection: 'column',
          height: 'min(88dvh, 760px)',
          fontFamily: FONT,
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 10px', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Biblioteca de hábitos</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Escolhe e adiciona à tua lista</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', border: 'none', cursor: 'pointer', color: 'var(--text1)', fontSize: 14, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Busca */}
        <div style={{ padding: '0 20px 10px', flexShrink: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍  Procurar hábito…"
            style={{
              width: '100%',
              background: 'var(--surface-2)',
              border: '1px solid rgba(var(--ink-rgb),0.10)',
              borderRadius: 13,
              padding: '12px 14px',
              color: 'var(--text1)',
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 600,
              outline: 'none',
            }}
          />
        </div>

        {/* Tabs de categoria (escondidas durante busca) */}
        {!query.trim() && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 12px', flexShrink: 0 }}>
            <Chip label="Todos" active={tab === 'all'} onClick={() => setTab('all')} />
            {AREAS.map((a) => (
              <Chip key={a} label={`${AREA_META[a].icon} ${AREA_META[a].label}`} active={tab === a} onClick={() => setTab(a)} />
            ))}
          </div>
        )}

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px calc(20px + env(safe-area-inset-bottom))' }}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '40px 0' }}>
              Nada encontrado para “{query}”.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((h) => {
                const added = isAdded(h)
                const busy = busyKey === h.key
                const meta = AREA_META[h.area]
                return (
                  <div
                    key={h.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: 'var(--surface-2)',
                      border: '1px solid rgba(var(--ink-rgb),0.07)',
                      borderRadius: 14,
                      padding: '11px 12px',
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0, width: 26, textAlign: 'center' }}>{h.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                        {meta.label} · {DIFFICULTY_LABEL[h.difficulty]}
                      </div>
                    </div>
                    <button
                      onClick={() => !added && !busy && onAdd(h)}
                      disabled={added || busy}
                      aria-label={added ? `${h.name} já adicionado` : `Adicionar ${h.name}`}
                      style={{
                        flexShrink: 0,
                        minWidth: 76,
                        height: 34,
                        borderRadius: 11,
                        fontFamily: FONT,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: added ? 'default' : 'pointer',
                        border: added ? '1px solid rgba(0,200,150,0.25)' : '1px solid rgba(245,200,66,0.4)',
                        background: added ? 'rgba(0,200,150,0.10)' : 'rgba(245,200,66,0.14)',
                        color: added ? 'var(--green-ink)' : 'var(--gold-ink)',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? '…' : added ? '✓ Adicionado' : '+ Adicionar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const style: CSSProperties = {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: 20,
    border: `1px solid ${active ? 'rgba(245,200,66,0.3)' : 'rgba(var(--ink-rgb),0.1)'}`,
    color: active ? 'var(--gold-ink)' : 'rgba(var(--ink-rgb),0.5)',
    background: active ? 'rgba(245,200,66,0.12)' : 'transparent',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  }
  return <button onClick={onClick} style={style}>{label}</button>
}
